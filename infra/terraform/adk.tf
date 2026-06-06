locals {
  adk_staging_bucket_name = coalesce(
    var.adk_staging_bucket_name,
    "${var.project_id}-consentops-adk-staging"
  )
}

resource "google_storage_bucket" "adk_staging" {
  count = var.create_adk_staging_bucket ? 1 : 0

  project  = var.project_id
  name     = local.adk_staging_bucket_name
  location = var.region
  labels   = local.labels

  uniform_bucket_level_access = true
  force_destroy               = true

  depends_on = [
    google_project_service.required,
    time_sleep.wait_for_apis,
  ]
}
