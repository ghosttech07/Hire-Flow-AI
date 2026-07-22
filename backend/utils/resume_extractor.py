"""
utils/resume_extractor.py
Unified text extraction from resumes and JD files.

Functions:
  extract_text_from_pdf(file_stream) -- stream/bytes -> text  (used by apply.py)
  extract_text_from_file(file_path)  -- file path -> text     (used by jobs.py)
"""

import os
import logging
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_stream) -> str:
    """
    Extract text from a PDF file stream or bytes object.

    Args:
        file_stream: A file-like object supporting read(), or raw bytes

    Returns:
        Cleaned plain text extracted from the PDF

    Raises:
        ValueError: If text extraction fails or yields less than 50 characters
    """
    try:
        if hasattr(file_stream, 'read'):
            file_bytes = file_stream.read()
            if hasattr(file_stream, 'seek'):
                file_stream.seek(0)
        else:
            file_bytes = file_stream

        if not file_bytes:
            raise ValueError("Empty file stream")

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text_parts = [page.get_text() for page in doc if page.get_text()]
        full_text = "\n".join(text_parts)
        clean_text = " ".join(full_text.split()).strip()

        logger.info(f"PDF text extraction: {len(clean_text)} chars from {len(doc)} pages")

        if len(clean_text) < 50:
            raise ValueError("Could not extract readable text from PDF")

        return clean_text

    except Exception as e:
        logger.error(f"Failed to extract text from PDF stream: {e}", exc_info=True)
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Could not extract readable text from PDF: {e}")


def extract_text_from_file(file_path: str) -> str:
    """
    Extract text from a file on disk. Supports .pdf, .docx, and .txt.

    Args:
        file_path: Absolute or relative path to the file

    Returns:
        Extracted plain text

    Raises:
        FileNotFoundError: If the file does not exist
        ValueError: If the file type is unsupported or extraction fails
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        with open(file_path, "rb") as f:
            return extract_text_from_pdf(f)

    elif ext == ".docx":
        try:
            from docx import Document  # python-docx
            doc = Document(file_path)
            text = "\n".join(p.text for p in doc.paragraphs).strip()
            logger.info(f"DOCX extraction: {len(text)} chars from {file_path}")
            return text
        except ImportError:
            raise ValueError("python-docx is not installed. Run: pip install python-docx")
        except Exception as e:
            raise ValueError(f"Failed to extract DOCX: {e}")

    elif ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read().strip()

    else:
        raise ValueError(f"Unsupported file type: {ext}. Supported: .pdf, .docx, .txt")


def extract_photo_from_pdf(file_stream) -> str | None:
    """
    Try to extract a candidate headshot from the first page of a PDF resume.

    Heuristic: finds the first embedded image that looks like a photo
    (roughly square, at least 60×60 px). Returns a base64-encoded JPEG
    data-URI string, or None if no suitable image is found.

    Args:
        file_stream: file-like object or raw bytes for the PDF

    Returns:
        str  -- "data:image/jpeg;base64,..." data-URI  (ready for <img src>)
        None -- no headshot found
    """
    try:
        import base64
        import io
        from PIL import Image

        if hasattr(file_stream, 'read'):
            pdf_bytes = file_stream.read()
            if hasattr(file_stream, 'seek'):
                file_stream.seek(0)
        else:
            pdf_bytes = file_stream

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        # Only scan the first two pages (headshots are almost always on page 1)
        for page_num in range(min(2, len(doc))):
            page = doc[page_num]
            images = page.get_images(full=True)

            for img_info in images:
                xref = img_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    img_bytes  = base_image["image"]
                    width      = base_image.get("width", 0)
                    height     = base_image.get("height", 0)

                    # Skip tiny images (icons, logos, decorations)
                    if width < 60 or height < 60:
                        continue

                    # Aspect ratio filter: photos are roughly 0.5–2.0 (portrait to landscape)
                    ratio = width / height if height else 0
                    if ratio < 0.4 or ratio > 2.5:
                        continue

                    # Convert to JPEG via PIL (handles PNG, BMP, TIFF, etc.)
                    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

                    # Resize to max 200×200 to keep DB payload small
                    img.thumbnail((200, 200), Image.LANCZOS)

                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=80, optimize=True)
                    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

                    logger.info(f"Extracted headshot from PDF page {page_num + 1}: {width}x{height}")
                    return f"data:image/jpeg;base64,{b64}"

                except Exception:
                    continue  # skip unreadable image

        logger.info("No headshot found in PDF resume")
        return None

    except ImportError:
        logger.warning("Pillow not installed — photo extraction disabled. Run: pip install Pillow")
        return None
    except Exception as e:
        logger.warning(f"Photo extraction failed (non-fatal): {e}")
        return None


def extract_name_from_resume_text(resume_text: str, fallback: str = "") -> str:
    """
    Parse the candidate's real name from the top of a cleaned resume text.

    Strategy: slide over the first ~20 tokens looking for a run of 2-4
    consecutive 'Name-like' tokens (Title-cased alphabetic words, not
    keywords like Email/Phone/LinkedIn/GitHub/Summary etc.).

    Args:
        resume_text: Cleaned plain text from extract_text_from_pdf()
        fallback:    Value to return if no name is detected (usually
                     the name the applicant typed in the form)

    Returns:
        Detected name string, or fallback if detection fails
    """
    import re

    # Common resume section keywords and noise to skip
    SKIP_TOKENS = {
        'email', 'phone', 'mobile', 'tel', 'linkedin', 'github', 'twitter',
        'summary', 'profile', 'objective', 'experience', 'education', 'skills',
        'contact', 'address', 'curriculum', 'vitae', 'resume', 'cv',
        'professional', 'senior', 'junior', 'lead', 'engineer', 'developer',
        'manager', 'director', 'analyst', 'designer', 'consultant', 'architect',
        'full', 'stack', 'software', 'backend', 'frontend', 'web', 'mobile',
    }

    # Work on first 200 chars of the resume text
    snippet = resume_text[:200]
    tokens = snippet.split()

    candidate_tokens = []
    for tok in tokens[:20]:
        # Strip punctuation from edges
        clean = re.sub(r'^[^A-Za-z]+|[^A-Za-z]+$', '', tok)

        # Must start with uppercase, be 2+ chars, only letters/hyphens/apostrophes
        if (clean
                and clean[0].isupper()
                and len(clean) >= 2
                and re.fullmatch(r"[A-Za-z][A-Za-z'\-]*", clean)
                and clean.lower() not in SKIP_TOKENS):
            candidate_tokens.append(clean)
        else:
            # Stop at first non-name token once we have >=2 words
            if len(candidate_tokens) >= 2:
                break
            # Reset if we hit noise before collecting 2 words
            candidate_tokens = []

    if len(candidate_tokens) >= 2:
        name = " ".join(candidate_tokens[:4])   # max 4 words
        logger.info(f"Parsed name from resume: '{name}'")
        return name

    logger.info(f"Could not parse name from resume, using fallback: '{fallback}'")
    return fallback
