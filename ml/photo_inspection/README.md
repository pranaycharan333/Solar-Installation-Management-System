# Solar Panel Photo Inspection

## Purpose and safety

This module prepares an object-detection model to flag visible solar-panel conditions for technician review. It does not make electrical-safety, warranty, or replacement decisions. Treat every prediction as an inspection suggestion and validate it with a qualified person.

## Dataset

The dataset is external and is not included in this repository. The working copy contains about 3,682 images, so keep it out of Git. Download the Solar Panel Faulty OD Final v5 dataset from [Roboflow Universe](https://universe.roboflow.com/6rainstorm-data-train/solar-panel-faulty-od-final/dataset/5) and review its CC BY 4.0 license and attribution requirements. Export it in YOLO format.

Place the extracted source dataset under `ml/photo_inspection/datasets/solar_panel_faults/` so it has `train`, `valid`, and `test` folders, each with `images` and `labels` subfolders. The `datasets/` directory is ignored by Git. From the repository root, convert segmentation polygons to detection bounding boxes while preserving the three splits:

```powershell
python ml/photo_inspection/scripts/convert_segmentation_to_detection.py
```

The converted dataset is written to `ml/photo_inspection/datasets/solar_panel_faults_detect/`; its configuration is `ml/photo_inspection/datasets/solar_panel_faults_detect/data.yaml`. The expected counts are 2,940 training images, 406 validation images, and 336 test images. The conversion output is also ignored by Git.

Class IDs in `data.yaml` are zero-based and ordered as follows:

| ID | Class |
|---:|---|
| 0 | Bird Drop |
| 1 | Defective |
| 2 | Dust |
| 3 | Non Defective |
| 4 | Physical Damage |
| 5 | Snow |

YOLO detection labels use one object per line: `class_id x_center y_center width height`, with coordinates normalized from 0 to 1. Images with no annotated objects have an empty label file.

## Training configuration

Use Ultralytics YOLO detection with the small pretrained `yolo11n.pt` checkpoint as a baseline. Recommended starting settings:

- Image size: 640
- Epochs: 100
- Batch size: 8 (reduce to 4 or 2 if GPU memory is insufficient)
- Data workers: 0 for a Windows environment
- Seed: 42
- Save outputs under `ml/outputs/photo_inspection/`

Run training only in an environment approved to load PyTorch. On this Windows machine, Code Integrity Event 3077 blocked PyTorch's `torch\\lib\\shm.dll`; do not change WDAC or Smart App Control settings to work around it. Copy the repository or at least the converted dataset and this module to the approved training environment first. If training on CPU, replace `device=0` with `device=cpu` and expect it to take longer.

From the repository root in the approved environment, run:

```powershell
& "ml/photo_inspection/.venv/Scripts/yolo.exe" detect train `
  data="ml/photo_inspection/datasets/solar_panel_faults_detect/data.yaml" `
  model=yolo11n.pt `
  imgsz=640 epochs=100 batch=8 workers=0 seed=42 device=0 `
  project="ml/outputs/photo_inspection" name="baseline-yolo11n"
```

If the approved environment is not Windows, activate its environment and run the equivalent `yolo detect train ...` command with the same arguments. Training may need network access to fetch the pretrained checkpoint; use only the official Ultralytics download mechanism or a checkpoint supplied by your organization.

## Evaluation

After training completes, evaluate the held-out test split with the best checkpoint. From the repository root:

```powershell
& "ml/photo_inspection/.venv/Scripts/yolo.exe" detect val `
  data="ml/photo_inspection/datasets/solar_panel_faults_detect/data.yaml" `
  model="ml/outputs/photo_inspection/baseline-yolo11n/weights/best.pt" `
  split=test imgsz=640 device=0
```

Record precision, recall, mAP@0.5, mAP@0.5:0.95, per-class results, and representative false positives and false negatives before deciding whether the model is suitable. Do not evaluate on the test split during model tuning. No model has been trained or evaluated yet.

## Limitations

Dataset labels and class balance need domain review. Detection quality may vary with lighting, camera angle, panel type, and condition severity. Low-confidence, unclear, or poor-quality photos should be referred for human review or retaken.
