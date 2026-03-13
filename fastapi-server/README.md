# FastAPI Server

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## YOLO Config

```bash
export SPRING_FILE_BASE_URL=http://localhost:8080
export YOLO_MODEL_PATH=/absolute/path/to/business-card-yolo.pt
export YOLO_CONFIDENCE=0.25
```

- `YOLO_MODEL_PATH` is optional. If omitted, FastAPI loads `yolov8n.pt`.
- Replace the default model with your trained business-card weights to get labels such as `name`, `company`, and `department`.
