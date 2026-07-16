"""documents.py router — project document store at /projects/{id}/documents.

Upload / list / download / delete files attached to a project (drawings,
certificates, registers). Any project viewer can upload and read; delete is
limited to the uploader or a project manager (enforced in the service).
"""

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.core.project_access import require_project, require_project_role
from app.core.storage import storage
from app.database.session import get_db
from app.models.auth import ProjectRole, User
from app.models.master import Project
from app.schemas.documents import DocumentCategory, DocumentResponse, DocumentReview
from app.services.document_service import DocumentService

router = APIRouter(prefix="/projects", tags=["documents"])


@router.get("/{project_id}/documents", response_model=list[DocumentResponse])
async def list_documents(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await DocumentService(db).list_for_project(project)


@router.post(
    "/{project_id}/documents", response_model=DocumentResponse, status_code=201
)
async def upload_document(
    file: UploadFile = File(...),
    document_type: DocumentCategory | None = Form(None),
    title: str | None = Form(None),
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    return await DocumentService(db).upload(
        project,
        current_user,
        filename=file.filename or "upload",
        content=content,
        content_type=file.content_type,
        document_type=document_type.value if document_type else None,
        title=title,
    )


@router.patch(
    "/{project_id}/documents/{document_id}/review", response_model=DocumentResponse
)
async def review_document(
    document_id: int,
    data: DocumentReview,
    project: Project = Depends(
        require_project_role(ProjectRole.QUALITY_ENGINEER, ProjectRole.PROJECT_MANAGER)
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A QE or PM approves / rejects an uploaded document."""
    return await DocumentService(db).review(project, document_id, data, current_user)


@router.get("/{project_id}/documents/{document_id}/download")
async def download_document(
    document_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    doc = await DocumentService(db).get_for_download(project, document_id)
    path = storage.path_for(doc.stored_key)
    if not path.exists():
        raise NotFoundError("Document file")
    return FileResponse(
        path,
        media_type=doc.content_type or "application/octet-stream",
        filename=doc.original_filename,
    )


@router.delete("/{project_id}/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: int,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await DocumentService(db).delete(project, current_user, document_id)
