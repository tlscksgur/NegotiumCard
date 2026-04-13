import os
import re
import tempfile
from contextlib import suppress
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
import pytesseract
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover - optional runtime dependency
    YOLO = None


DEFAULT_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
SPRING_FILE_BASE_URL = os.getenv("SPRING_FILE_BASE_URL", "http://localhost:8080")
YOLO_CONFIDENCE = float(os.getenv("YOLO_CONFIDENCE", "0.25"))
OCR_LANGS = os.getenv("OCR_LANGS", "kor+eng")

app = FastAPI(title="Negotium Card AI Server", version="0.3.0")

_model: Any = None
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

    if YOLO is None:
        _model = None
        _model_error = "YOLO dependency is not installed."
        return

    try:
        _model = YOLO(DEFAULT_MODEL_PATH)
        _model_error = None
    except Exception as error:  # pragma: no cover - runtime configuration path
        _model = None
        _model_error = str(error)


def require_model() -> Any:
    load_model()
    if _model is None:
        message = "YOLO model could not be loaded."
        if _model_error:
            message = f"{message} {_model_error}"
        raise HTTPException(status_code=503, detail=message)
    return _model


def resolve_image_url(image_url: str) -> str:
    if image_url.startswith(("http://", "https://")):
        parsed_url = urlparse(image_url)
        spring_url = urlparse(SPRING_FILE_BASE_URL)
        if parsed_url.netloc and parsed_url.netloc != spring_url.netloc:
            raise HTTPException(status_code=400, detail="External image URLs are not allowed.")
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


def split_name_and_position(line: str) -> tuple[str, str] | None:
    compact = " ".join(line.split())

    korean_mixed = re.match(r"^([\uac00-\ud7a3]{2,5})\s+(.+)$", compact)
    if korean_mixed:
        candidate_name = korean_mixed.group(1).strip()
        candidate_position = korean_mixed.group(2).strip()
        if candidate_position and re.search(r"[A-Za-z\uac00-\ud7a3]", candidate_position):
            return candidate_name, candidate_position

    boundary = re.match(r"^([\uac00-\ud7a3]{2,5})([A-Z][A-Za-z].+)$", compact)
    if boundary:
        return boundary.group(1).strip(), boundary.group(2).strip()

    english_mixed = re.match(r"^([A-Za-z][A-Za-z\s.'-]{1,40})\s{2,}([A-Za-z][A-Za-z\s/&-]{1,40})$", compact)
    if english_mixed:
        return english_mixed.group(1).strip(), english_mixed.group(2).strip()

    return None


def is_address_line(line: str) -> bool:
    lowered = line.lower()
    address_keywords = (
        "street",
        "st.",
        "st ",
        "road",
        "ro ",
        "city",
        "gu",
        "dong",
        "ro-gil",
        "busan",
        "seoul",
        "suite",
        "floor",
        "building",
        "bldg",
        "avenue",
        "addr",
        "address",
        "\uc11c\uc6b8",
        "\ubd80\uc0b0",
        "\uad6c",
        "\ub3d9",
        "\ub85c",
        "\uae38",
        "\ucda9",
        "\uccad",
        "\uc2dc",
        "\uc9c0\ud558",
        "\uc2e4",
        "\uc804\ud654",
    )
    return any(keyword in lowered for keyword in address_keywords) or bool(re.search(r"\d{2,}", line))


def parse_ocr_fields(lines: list[str]) -> dict[str, str | None]:
    email_pattern = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
    phone_pattern = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?(?:\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4})")
    department_keywords = (
        "team",
        "dept",
        "department",
        "division",
        "chapter",
        "squad",
        "group",
        "\ubd80\uc11c",
        "\ubcf8\ubd80",
        "\ud300",
        "\ud30c\ud2b8",
        "\uc2e4",
        "\uc870\uc9c1",
    )
    position_keywords = (
        "ceo",
        "cto",
        "cfo",
        "coo",
        "vp",
        "manager",
        "director",
        "lead",
        "head",
        "staff",
        "engineer",
        "designer",
        "chief",
        "president",
        "intern",
        "member",
        "\uc9c1\ucc45",
        "\ub300\ud45c",
        "\uc0ac\uc7a5",
        "\uc804\ubb34",
        "\uc0c1\ubb34",
        "\ubd80\uc7a5",
        "\ucc28\uc7a5",
        "\uacfc\uc7a5",
        "\ub300\ub9ac",
        "\uc8fc\uc784",
        "\uc0ac\uc6d0",
    )
    company_keywords = (
        "inc",
        "corp",
        "co.",
        "ltd",
        "llc",
        "company",
        "group",
        "systems",
        "tech",
        "\uc8fc\uc2dd\ud68c\uc0ac",
        "\ud68c\uc0ac",
        "\uae30\uc5c5",
        "\uadf8\ub8f9",
        "\ud14c\ud06c",
        "\uc2dc\uc2a4\ud15c",
    )

    normalized_lines: list[str] = []
    split_name: str | None = None
    split_position: str | None = None

    for line in lines:
        split_line = split_name_and_position(line)
        if split_line:
            split_name = split_name or split_line[0]
            split_position = split_position or split_line[1]
            normalized_lines.extend(split_line)
        else:
            normalized_lines.append(line)

    email = next((match.group(0) for line in normalized_lines for match in [email_pattern.search(line)] if match), None)
    phone = next((match.group(0) for line in normalized_lines for match in [phone_pattern.search(line)] if match), None)

    remaining = [
        line
        for line in normalized_lines
        if line != email and line != phone and not email_pattern.search(line) and not phone_pattern.search(line)
    ]

    name = split_name or next(
        (
            line
            for line in remaining
            if 1 < len(line) <= 20 and not any(char.isdigit() for char in line) and not is_address_line(line)
        ),
        None,
    )
    department = next((line for line in remaining if any(keyword in line.lower() for keyword in department_keywords)), None)
    position = split_position or next((line for line in remaining if any(keyword in line.lower() for keyword in position_keywords)), None)
    company = next(
        (
            line
            for line in remaining
            if any(keyword in line.lower() for keyword in company_keywords) and line not in {name, department, position}
        ),
        None,
    )

    if company is None:
        for line in remaining:
            if line not in {name, department, position} and not is_address_line(line):
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
        "ocrLangs": OCR_LANGS,
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
        raw_text = pytesseract.image_to_string(str(image_path), lang=OCR_LANGS)
        sorted_lines = [line.strip() for line in raw_text.splitlines() if not is_noise(line)]
        parsed = parse_ocr_fields(sorted_lines)

        return OcrAnalyzeResponse(
            image_url=request.image_url,
            raw_text="\n".join(sorted_lines),
            name=parsed["name"],
            company=parsed["company"],
            department=parsed["department"],
            position=parsed["position"],
            email=parsed["email"],
            phone=parsed["phone"],
        )
    except pytesseract.TesseractNotFoundError as error:  # pragma: no cover - runtime environment path
        raise HTTPException(status_code=503, detail=f"OCR engine is not installed: {error}") from error
    except Exception as error:  # pragma: no cover - OCR runtime path
        raise HTTPException(status_code=500, detail=f"OCR failed: {error}") from error
    finally:
        with suppress(FileNotFoundError):
            image_path.unlink()
