-- Synthetic ConsentOps demo tables (Ana Reyes fixture mirror).
-- Replace PROJECT and DATASET before running, or use bq query with default project.

CREATE TABLE IF NOT EXISTS `consentops_demo.crm_customers` (
  id STRING NOT NULL,
  email STRING,
  phone STRING,
  customerId STRING,
  emailSha256 STRING,
  fullName STRING
);

CREATE TABLE IF NOT EXISTS `consentops_demo.commerce_orders` (
  id STRING NOT NULL,
  email STRING,
  phone STRING,
  customerId STRING,
  emailSha256 STRING,
  orderTotal FLOAT64
);

CREATE TABLE IF NOT EXISTS `consentops_demo.support_tickets` (
  id STRING NOT NULL,
  email STRING,
  phone STRING,
  customerId STRING,
  emailSha256 STRING,
  subject STRING
);

CREATE TABLE IF NOT EXISTS `consentops_demo.marketing_email_events` (
  id STRING NOT NULL,
  email STRING,
  phone STRING,
  customerId STRING,
  emailSha256 STRING,
  campaign STRING
);

CREATE TABLE IF NOT EXISTS `consentops_demo.analytics_customer_360` (
  id STRING NOT NULL,
  email STRING,
  phone STRING,
  customerId STRING,
  emailSha256 STRING,
  segment STRING
);

CREATE TABLE IF NOT EXISTS `consentops_demo.ai_training_feedback_export` (
  id STRING NOT NULL,
  email STRING,
  phone STRING,
  customerId STRING,
  emailSha256 STRING,
  feedbackType STRING
);

CREATE TABLE IF NOT EXISTS `consentops_demo.payments_transactions` (
  id STRING NOT NULL,
  email STRING,
  phone STRING,
  customerId STRING,
  emailSha256 STRING,
  amount FLOAT64
);
