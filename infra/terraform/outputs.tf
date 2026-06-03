output "cloud_run_url" {
  description = "HTTPS URL for the deployed ConsentOps demo."
  value       = google_cloud_run_v2_service.consentops.uri
}

output "cloud_run_service_name" {
  value = google_cloud_run_v2_service.consentops.name
}

output "runtime_service_account" {
  value = google_service_account.cloud_run.email
}

output "artifact_registry_repository" {
  description = "Docker repository id (if created)."
  value       = var.create_artifact_registry ? google_artifact_registry_repository.consentops[0].id : null
}

output "suggested_image_uri" {
  description = "Example image URI after docker push to Artifact Registry."
  value = var.create_artifact_registry ? (
    "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repository_id}/${var.service_name}:latest"
  ) : null
}

output "gemini_secret_id" {
  description = "Secret Manager id when enable_gemini_secret is true (add version with gcloud, not in git)."
  value       = var.enable_gemini_secret ? google_secret_manager_secret.gemini[0].secret_id : null
}
