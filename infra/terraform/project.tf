data "google_project" "current" {
  project_id = var.project_id
}

locals {
  artifact_registry_host = "${var.region}-docker.pkg.dev/${var.project_id}"
}

check "container_image_project" {
  assert {
    condition = !can(regex("-docker\\.pkg\\.dev/", var.container_image)) || can(
      regex("^${regexescape(local.artifact_registry_host)}/", var.container_image)
    )
    error_message = <<-EOT
      container_image must use this project's Artifact Registry host:
        ${local.artifact_registry_host}/...
      You still have a placeholder (e.g. my-gcp-project) in the image URI. That makes Cloud Run
      validate a different GCP project and can return a misleading "Artifact Registry API disabled" 403.
    EOT
  }
}
