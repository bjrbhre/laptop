"""Convert PDF/DOCX documents to Markdown using Docling.

Supports:
  - Single file:  convert file.pdf              -> file.md (next to source)
  - Single file:  convert file.pdf out.md        -> out.md
  - Single file:  convert file.pdf ./some/dir/   -> ./some/dir/file.md
  - Directory:    convert ./docs/ ./md/           -> mirrors structure
  - Directory:    convert ./docs/                 -> ./docs/ (in-place, .md next to sources)
"""

import argparse
import sys
from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TableStructureOptions
from docling.document_converter import DocumentConverter, PdfFormatOption, WordFormatOption


def build_converter() -> DocumentConverter:
    """Build a DocumentConverter with table structure extraction enabled."""
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_table_structure = True
    pipeline_options.table_structure_options = TableStructureOptions(do_cell_matching=True)

    return DocumentConverter(
        allowed_formats=[InputFormat.PDF, InputFormat.DOCX],
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
            InputFormat.DOCX: WordFormatOption(),
        },
    )


SUPPORTED_EXTENSIONS = {".pdf", ".docx"}


def resolve_output(source: Path, input_root: Path, output: Path | None) -> Path:
    """Compute the output .md path for a given source file.

    Rules:
      - output is None         -> .md next to source
      - output is a .md file   -> use as-is (only valid for single-file input)
      - output is a directory  -> mirror relative path from input_root, append .md
    """
    if output is None:
        return source.with_suffix(".md")
    if output.suffix == ".md":
        return output
    # output is a directory: mirror structure
    relative = source.relative_to(input_root)
    return output / relative.with_suffix(".md")


def find_documents(input_dir: Path) -> list[Path]:
    """Recursively find all supported document files under input_dir."""
    return sorted(f for f in input_dir.rglob("*") if f.suffix.lower() in SUPPORTED_EXTENSIONS)


def run_conversion(docs: list[Path], input_root: Path, output: Path | None, *, dry_run: bool) -> None:
    """Convert a list of documents and write Markdown output."""
    if not docs:
        print("No supported documents found.")
        return

    pairs = [(doc, resolve_output(doc, input_root, output)) for doc in docs]

    # Summary
    ext_counts: dict[str, int] = {}
    for doc, _ in pairs:
        ext_counts[doc.suffix] = ext_counts.get(doc.suffix, 0) + 1
    summary = ", ".join(f"{count} {ext}" for ext, count in sorted(ext_counts.items()))
    print(f"Found {len(docs)} document(s) ({summary}).\n")

    if dry_run:
        for doc, out_path in pairs:
            print(f"  {doc}  ->  {out_path}")
        print("\nDry run — no files written.")
        return

    converter = build_converter()
    successes, failures = 0, 0

    for doc, out_path in pairs:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Converting: {doc.name} ...", end=" ", flush=True)
        try:
            result = converter.convert(doc)
            out_path.write_text(result.document.export_to_markdown(), encoding="utf-8")
            print(f"OK  ->  {out_path}")
            successes += 1
        except Exception as exc:
            print(f"FAILED ({exc})")
            failures += 1

    print(f"\nDone: {successes} succeeded, {failures} failed.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert PDF/DOCX documents to Markdown using Docling.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  convert report.pdf                        # -> report.md (next to source)
  convert report.pdf summary.md             # -> summary.md
  convert report.pdf ./output/              # -> ./output/report.md

  convert ./docs/                           # -> .md next to each source
  convert ./docs/ ./md/                     # -> mirrors structure into ./md/
  convert ./docs/ ./md/ --check             # dry run

supported formats: .pdf, .docx
""",
    )
    parser.add_argument(
        "input",
        type=Path,
        help="File (.pdf/.docx) or directory to convert.",
    )
    parser.add_argument(
        "output",
        type=Path,
        nargs="?",
        default=None,
        help=(
            "Output path. "
            "For a file input: a .md path or a directory (default: .md next to source). "
            "For a directory input: output directory (default: in-place next to sources)."
        ),
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Dry run: show what would be converted without writing files.",
    )
    args = parser.parse_args()

    input_path: Path = args.input.resolve()
    output_path: Path | None = args.output.resolve() if args.output else None

    if not input_path.exists():
        print(f"Error: input does not exist: {input_path}", file=sys.stderr)
        sys.exit(1)

    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            print(f"Error: unsupported format '{input_path.suffix}' (use .pdf or .docx)", file=sys.stderr)
            sys.exit(1)
        docs = [input_path]
        input_root = input_path.parent
    else:
        docs = find_documents(input_path)
        input_root = input_path

    run_conversion(docs, input_root, output_path, dry_run=args.check)


if __name__ == "__main__":
    main()
