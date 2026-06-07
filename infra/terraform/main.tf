locals {
  labels = {
    app         = "consentops-agent"
    environment = "hackathon-demo"
  }

  env_vars = [
    { name = "DEMO_MODE", value = "true" },
    { name = "CONSENTOPS_DEMO_MODE", value = "true" },
    { name = "GEMINI_MODEL", value = var.gemini_model },
    { name = "CONSENTOPS_WAREHOUSE_MODE", value = var.warehouse_mode },
    { name = "GOOGLE_CLOUD_PROJECT", value = var.project_id },
    { name = "BIGQUERY_DATASET", value = var.bigquery_dataset },
    { name = "FIVETRAN_MCP_RUNTIME", value = var.fivetran_mcp_runtime ? "true" : "false" },
    { name = "FIVETRAN_ALLOW_WRITES", value = "false" },
    { name = "NODE_ENV", value = "production" },
  ]

  secret_env = concat(
    var.mount_gemini_secret ? [
      {
        name      = "GEMINI_API_KEY"
        secret_id = google_secret_manager_secret.gemini[0].secret_id
        version   = "latest"
      }
    ] : [],
    var.mount_fivetran_secrets ? [
      {
        name      = "FIVETRAN_API_KEY"
        secret_id = google_secret_manager_secret.fivetran_key[0].secret_id
        version   = "latest"
      },
      {
        name      = "FIVETRAN_API_SECRET"
        secret_id = google_secret_manager_secret.fivetran_secret[0].secret_id
        version   = "latest"
      },
    ] : [],
  )
}

resource "google_project_service" "required" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "aiplatform.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# API enablement is async; Cloud Run can 403 if Artifact Registry is not propagated yet.
resource "time_sleep" "wait_for_apis" {
  create_duration = "90s"

  depends_on = [google_project_service.required]

  triggers = {
    services = join(",", sort(keys(google_project_service.required)))
  }
}

resource "google_artifact_registry_repository" "consentops" {
  count = var.create_artifact_registry ? 1 : 0

  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repository_id
  description   = "ConsentOps hackathon demo container images"
  format        = "DOCKER"
  labels        = local.labels

  depends_on = [
    google_project_service.required,
    time_sleep.wait_for_apis,
  ]
}

resource "google_service_account" "cloud_run" {
  project      = var.project_id
  account_id   = "${var.service_name}-run"
  display_name = "ConsentOps Cloud Run runtime"
}

resource "google_secret_manager_secret" "gemini" {
  count = var.enable_gemini_secret ? 1 : 0

  project   = var.project_id
  secret_id = var.gemini_secret_id

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [
    google_project_service.required,
    time_sleep.wait_for_apis,
  ]
}

resource "google_secret_manager_secret_iam_member" "gemini_accessor" {
  count = var.enable_gemini_secret ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.gemini[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_secret_manager_secret" "fivetran_key" {
  count = var.enable_fivetran_secrets ? 1 : 0

  project   = var.project_id
  secret_id = var.fivetran_key_secret_id

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [
    google_project_service.required,
    time_sleep.wait_for_apis,
  ]
}

resource "google_secret_manager_secret" "fivetran_secret" {
  count = var.enable_fivetran_secrets ? 1 : 0

  project   = var.project_id
  secret_id = var.fivetran_api_secret_id

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [
    google_project_service.required,
    time_sleep.wait_for_apis,
  ]
}

resource "google_secret_manager_secret_iam_member" "fivetran_key_accessor" {
  count = var.enable_fivetran_secrets ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.fivetran_key[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_secret_manager_secret_iam_member" "fivetran_secret_accessor" {
  count = var.enable_fivetran_secrets ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.fivetran_secret[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "cloud_run_bigquery_data_editor" {
  count = var.grant_bigquery_roles ? 1 : 0

  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "cloud_run_bigquery_job_user" {
  count = var.grant_bigquery_roles ? 1 : 0

  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Run must read the image from Artifact Registry in this project.
resource "google_project_iam_member" "serverless_robot_ar_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:service-${data.google_project.current.number}@serverless-robot-prod.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "cloud_run_sa_ar_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_cloud_run_v2_service" "consentops" {
  project  = var.project_id
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  labels = local.labels

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      max_instance_count = var.max_instances
    }

    containers {
      image = var.container_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
      }

      dynamic "env" {
        for_each = local.env_vars
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = env.value.version
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    time_sleep.wait_for_apis,
    google_project_iam_member.serverless_robot_ar_reader,
    google_project_iam_member.cloud_run_sa_ar_reader,
  ]

  lifecycle {
    ignore_changes = [
      # Allow image tag updates outside Terraform (docker push + gcloud deploy)
      template[0].containers[0].image,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.consentops.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
