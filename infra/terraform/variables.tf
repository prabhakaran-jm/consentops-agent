variable "project_id" {
  type        = string
  description = "GCP project ID for Cloud Run and Artifact Registry."
}

variable "region" {
  type        = string
  description = "GCP region for Cloud Run and Artifact Registry."
  default     = "us-central1"
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name."
  default     = "consentops-agent"
}

variable "container_image" {
  type        = string
  description = "Full container image URI (build and push before apply). Example: us-central1-docker.pkg.dev/PROJECT/consentops/consentops-agent:latest"
}

variable "allow_unauthenticated" {
  type        = bool
  description = "If true, grant public run.invoker for hackathon demo URL."
  default     = true
}

variable "max_instances" {
  type        = number
  description = "Max Cloud Run instances (use 1 for in-memory demo workflow)."
  default     = 1
}

variable "create_artifact_registry" {
  type        = bool
  description = "Create Artifact Registry repository for demo images."
  default     = true
}

variable "artifact_repository_id" {
  type        = string
  description = "Artifact Registry repository id."
  default     = "consentops"
}

variable "enable_gemini_secret" {
  type        = bool
  description = "Create Secret Manager secret resource and grant the runtime service account accessor."
  default     = false
}

variable "mount_gemini_secret" {
  type        = bool
  description = "Mount GEMINI_API_KEY on Cloud Run from Secret Manager. Requires enable_gemini_secret and at least one secret version (add via gcloud, never Terraform)."
  default     = false

  validation {
    condition     = !var.mount_gemini_secret || var.enable_gemini_secret
    error_message = "mount_gemini_secret requires enable_gemini_secret = true."
  }
}

variable "gemini_secret_id" {
  type        = string
  description = "Secret Manager secret id for Gemini API key."
  default     = "GEMINI_API_KEY"
}

variable "gemini_model" {
  type        = string
  description = "Gemini model id passed to the app."
  default     = "gemini-2.5-flash"
}
