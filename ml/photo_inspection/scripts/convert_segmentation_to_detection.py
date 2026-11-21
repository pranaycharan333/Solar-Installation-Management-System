
from pathlib import Path
import shutil

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[3]

SOURCE_DATASET = (
    PROJECT_ROOT
    / "ml"
    / "photo_inspection"
    / "datasets"
    / "solar_panel_faults"
)

OUTPUT_DATASET = (
    PROJECT_ROOT
    / "ml"
    / "photo_inspection"
    / "datasets"
    / "solar_panel_faults_detect"
)

SPLITS = ["train", "valid", "test"]

IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".bmp", ".webp"
}


def convert_label_line(line: str, label_path: Path) -> str:
    """Convert one YOLO detection or segmentation annotation to detection format."""

    values = line.strip().split()

    if not values:
        return ""

    class_id = int(values[0])
    coordinates = [float(value) for value in values[1:]]

    if class_id < 0 or class_id >= 6:
        raise ValueError(f"Invalid class ID in {label_path}")

    # Already a YOLO detection bounding box.
    if len(values) == 5:
        x_center, y_center, width, height = coordinates

    # YOLO segmentation polygon: class + coordinate pairs.
    elif len(coordinates) >= 6 and len(coordinates) % 2 == 0:
        x_points = coordinates[0::2]
        y_points = coordinates[1::2]

        x_min = min(x_points)
        x_max = max(x_points)
        y_min = min(y_points)
        y_max = max(y_points)

        x_center = (x_min + x_max) / 2
        y_center = (y_min + y_max) / 2
        width = x_max - x_min
        height = y_max - y_min

    else:
        raise ValueError(
            f"Unexpected annotation format in {label_path}: {line}"
        )

    # Validate normalized coordinates.
    box = [x_center, y_center, width, height]

    if any(value < 0 or value > 1 for value in box):
        raise ValueError(f"Invalid bounding box in {label_path}")

    return (
        f"{class_id} "
        f"{x_center:.8f} "
        f"{y_center:.8f} "
        f"{width:.8f} "
        f"{height:.8f}"
    )


def main():
    if not SOURCE_DATASET.exists():
        raise FileNotFoundError(
            f"Original dataset not found: {SOURCE_DATASET}"
        )

    total_images = 0
    total_objects = 0

    for split in SPLITS:
        source_images = SOURCE_DATASET / split / "images"
        source_labels = SOURCE_DATASET / split / "labels"

        output_images = OUTPUT_DATASET / split / "images"
        output_labels = OUTPUT_DATASET / split / "labels"

        if not source_images.exists() or not source_labels.exists():
            raise FileNotFoundError(
                f"Missing images or labels for split: {split}"
            )

        output_images.mkdir(parents=True, exist_ok=True)
        output_labels.mkdir(parents=True, exist_ok=True)

        image_files = [
            path for path in source_images.iterdir()
            if path.is_file()
            and path.suffix.lower() in IMAGE_EXTENSIONS
        ]

        label_files = {
            path.stem: path
            for path in source_labels.glob("*.txt")
        }

        for image_path in image_files:
            label_path = label_files.get(image_path.stem)

            # Copy the image; original remains untouched.
            shutil.copy2(
                image_path,
                output_images / image_path.name
            )

            output_label = output_labels / f"{image_path.stem}.txt"

            if label_path is None:
                # An image without objects gets an empty label.
                output_label.write_text("", encoding="utf-8")
            else:
                converted_lines = []

                for line in label_path.read_text(
                    encoding="utf-8"
                ).splitlines():
                    if line.strip():
                        converted_lines.append(
                            convert_label_line(line, label_path)
                        )

                output_label.write_text(
                    "\n".join(converted_lines),
                    encoding="utf-8"
                )

                total_objects += len(converted_lines)

            total_images += 1

        print(
            f"{split}: converted {len(image_files)} images"
        )

    # Create detection dataset configuration.
    data_yaml = """\
train: train/images
val: valid/images
test: test/images

nc: 6
names: ['Bird Drop', 'Defective', 'Dust', 'Non Defective', 'Physical Damage', 'Snow']
"""

    (OUTPUT_DATASET / "data.yaml").write_text(
        data_yaml,
        encoding="utf-8"
    )

    print("\nConversion completed.")
    print(f"Images copied: {total_images}")
    print(f"Objects converted: {total_objects}")
    print(f"Output dataset: {OUTPUT_DATASET}")


if __name__ == "__main__":
    main()
