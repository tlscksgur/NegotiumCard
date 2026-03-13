import os
import re
import tempfile
from contextlib import suppress
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from ocrmac import ocrmac
from pydantic import BaseModel, ConfigDict, Field
from ultralytics import YOLO


DEFAULT_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
SPRING_FILE_BASE_URL = os.getenv("SPRING_FILE_BASE_URL", "http://localhost:8080")
YOLO_CONFIDENCE = float(os.getenv("YOLO_CONFIDENCE", "0.25"))

app = FastAPI(title="Negotium Card AI Server", version="0.2.0")

_model: YOLO | None = None
_model_error: str | None = None


class YoloAnalyzeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    image_url: str = Field(alias="imageUrl")


class DetectionItem(BaseModel):
    label: str
    x: float
    y: float
    width: float
    height: float
    confidence: float


class YoloAnalyzeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    image_url: str = Field(alias="imageUrl")
    detections: list[DetectionItem]


class OcrAnalyzeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    image_url: str = Field(alias="imageUrl")


class OcrAnalyzeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    image_url: str = Field(alias="imageUrl")
    raw_text: str = Field(alias="rawText")
    name: str | None = None
    company: str | None = None
    department: str | None = None
    position: str | None = None
    email: str | None = None
    phone: str | None = None


def load_model() -> None:
    global _model, _model_error
    if _model is not None:
        return

    try:
        _model = YOLO(DEFAULT_MODEL_PATH)
        _model_error = None
    except Exception as error:  # pragma: no cover - runtime configuration path
        _model = None
        _model_error = str(error)


def require_model() -> YOLO:
    load_model()
    if _model is None:
        message = "YOLO model could not be loaded."
        if _model_error:
            message = f"{message} {_model_error}"
        raise HTTPException(status_code=503, detail=message)
    return _model


def resolve_image_url(image_url: str) -> str:
    if image_url.startswith(("http://", "https://")):
        return image_url
    if image_url.startswith("/"):
        return f"{SPRING_FILE_BASE_URL.rstrip('/')}{image_url}"
    return image_url


def download_image(image_url: str) -> Path:
    resolved_url = resolve_image_url(image_url)
    response = httpx.get(resolved_url, timeout=30.0)
    response.raise_for_status()

    suffix = Path(resolved_url).suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(response.content)
        return Path(temp_file.name)


def normalize(value: float) -> float:
    return round(value, 6)


def is_noise(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    if len(stripped) == 1 and not stripped.isalpha():
        return True
    return False


def parse_ocr_fields(lines: list[str]) -> dict[str, str | None]:
    email_pattern = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
    phone_pattern = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?(?:\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4})")

    email = next((match.group(0) for line in lines for match in [email_pattern.search(line)] if match), None)
    phone = next((match.group(0) for line in lines for match in [phone_pattern.search(line)] if match), None)

    remaining = [
        line for line in lines
        if line != email and line != phone and not email_pattern.search(line) and not phone_pattern.search(line)
    ]

    department_keywords = ("팀", "본부", "부서", "센터", "실", "랩", "그룹", "chapter", "squad", "team", "department")
    position_keywords = ("ceo", "cto", "manager", "director", "lead", "head", "staff", "engineer", "대표", "이사", "팀장", "매니저", "사원", "과장", "부장")
    company_keywords = ("inc", "corp", "co.", "ltd", "llc", "company", "전자", "테크", "기업", "주식회사")

    name = next((line for line in remaining if 1 < len(line) <= 20 and not any(char.isdigit() for char in line)), None)
    department = next((line for line in remaining if any(keyword in line.lower() for keyword in department_keywords)), None)
    position = next((line for line in remaining if any(keyword in line.lower() for keyword in position_keywords)), None)
    company = next((line for line in remaining if any(keyword in line.lower() for keyword in company_keywords)), None)

    if company is None:
        for line in remaining:
            if line not in {name, department, position}:
                company = line
                break

    return {
        "name": name,
        "company": company,
        "department": department,
        "position": position,
        "email": email,
        "phone": phone,
    }


@app.on_event("startup")
def startup() -> None:
    load_model()


@app.get("/health")
def health() -> dict[str, object]:
    load_model()
    return {
        "status": "ok",
        "service": "fastapi",
        "modelLoaded": _model is not None,
        "modelPath": DEFAULT_MODEL_PATH,
        "modelError": _model_error,
    }


@app.post("/analyze/yolo", response_model=YoloAnalyzeResponse, response_model_by_alias=True)
def analyze_yolo(request: YoloAnalyzeRequest) -> YoloAnalyzeResponse:
    model = require_model()
    image_path = download_image(request.image_url)

    try:
        result = model.predict(source=str(image_path), conf=YOLO_CONFIDENCE, verbose=False)[0]
        image_height, image_width = result.orig_shape
        detections: list[DetectionItem] = []

        if result.boxes is not None:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = float(box.conf[0].item())
                class_id = int(box.cls[0].item())
                label = str(result.names[class_id])

                detections.append(
                    DetectionItem(
                        label=label,
                        x=normalize(x1 / image_width),
                        y=normalize(y1 / image_height),
                        width=normalize((x2 - x1) / image_width),
                        height=normalize((y2 - y1) / image_height),
                        confidence=normalize(confidence),
                    )
                )

        return YoloAnalyzeResponse(image_url=request.image_url, detections=detections)
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Failed to download image: {error}") from error
    except HTTPException:
        raise
    except Exception as error:  # pragma: no cover - model/runtime path
        raise HTTPException(status_code=500, detail=f"YOLO inference failed: {error}") from error
    finally:
        with suppress(FileNotFoundError):
            image_path.unlink()


@app.post("/analyze/ocr", response_model=OcrAnalyzeResponse, response_model_by_alias=True)
def analyze_ocr(request: OcrAnalyzeRequest) -> OcrAnalyzeResponse:
    image_path = download_image(request.image_url)

    try:
        annotations = ocrmac.OCR(
            str(image_path),
            language_preference=["ko-KR", "en-US"],
            recognition_level="accurate",
        ).recognize()

        sorted_lines = [
            text.strip()
            for text, _, bbox in sorted(annotations, key=lambda item: (round(item[2][1], 3), item[2][0]))
            if not is_noise(text)
        ]
        raw_text = "\n".join(sorted_lines)
        parsed = parse_ocr_fields(sorted_lines)

        return OcrAnalyzeResponse(
            image_url=request.image_url,
            raw_text=raw_text,
            name=parsed["name"],
            company=parsed["company"],
            department=parsed["department"],
            position=parsed["position"],
            email=parsed["email"],
            phone=parsed["phone"],
        )
    except Exception as error:  # pragma: no cover - OCR runtime path
        raise HTTPException(status_code=500, detail=f"OCR failed: {error}") from error
    finally:
        with suppress(FileNotFoundError):
            image_path.unlink()
