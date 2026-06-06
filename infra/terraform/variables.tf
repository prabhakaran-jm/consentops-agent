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
  description = "Gemini model id passed to the app (Gemini API on Cloud Run)."
  default     = "gemini-3.5-flash"
}

variable "warehouse_mode" {
  type        = string
  description = "CONSENTOPS_WAREHOUSE_MODE: local_json | bigquery_scan | bigquery_full."
  default     = "bigquery_full"

  validation {
    condition     = contains(["local_json", "bigquery_scan", "bigquery_full"], var.warehouse_mode)
    error_message = "warehouse_mode must be local_json, bigquery_scan, or bigquery_full."
  }
}

variable "bigquery_dataset" {
  type        = string
  description = "BigQuery dataset for synthetic demo warehouse tables."
  default     = "consentops_demo"
}

variable "fivetran_mcp_runtime" {
  type        = bool
  description = "Enable Fivetran MCP runtime (read-only) on Cloud Run."
  default     = true
}

variable "grant_bigquery_roles" {
  type        = bool
  description = "Grant Cloud Run service account BigQuery dataEditor and jobUser."
  default     = true
}

variable "enable_fivetran_secrets" {
  type        = bool
  description = "Create Secret Manager resources for Fivetran API credentials."
  default     = false
}

variable "mount_fivetran_secrets" {
  type        = bool
  description = "Mount FIVETRAN_API_KEY and FIVETRAN_API_SECRET on Cloud Run from Secret Manager."
  default     = false

  validation {
    condition     = !var.mount_fivetran_secrets || var.enable_fivetran_secrets
    error_message = "mount_fivetran_secrets requires enable_fivetran_secrets = true."
  }
}

variable "fivetran_key_secret_id" {
  type        = string
  description = "Secret Manager secret id for FIVETRAN_API_KEY."
  default     = "FIVETRAN_API_KEY"
}

variable "fivetran_api_secret_id" {
  type        = string
  description = "Secret Manager secret id for FIVETRAN_API_SECRET."
  default     = "FIVETRAN_API_SECRET"
}

variable "create_adk_staging_bucket" {
  type        = bool
  description = "Create a GCS bucket for adk deploy agent_engine staging artifacts."
  default     = true
}

variable "adk_staging_bucket_name" {
  type        = string
  description = "GCS bucket name for ADK staging. Empty uses {project_id}-consentops-adk-staging."
  default     = ""
}
