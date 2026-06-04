data "google_project" "current" {
  project_id = var.project_id
}

locals {
  artifact_registry_host = "${var.region}-docker.pkg.dev/${var.project_id}"
}

check "container_image_project" {
  assert {
    condition = !strcontains(var.container_image, "-docker.pkg.dev/") || startswith(
      var.container_image,
      "${local.artifact_registry_host}/",
    )
    error_message = <<-EOT
      container_image must use this project's Artifact Registry host:
        ${local.artifact_registry_host}/...
      You still have a placeholder (e.g. my-gcp-project) in the image URI. That makes Cloud Run
      validate a different GCP project and can return a misleading "Artifact Registry API disabled" 403.
    EOT
  }
}
