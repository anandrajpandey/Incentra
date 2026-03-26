variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "Optional AWS CLI profile name. Leave empty to use default credentials/environment variables."
  type        = string
  default     = ""
}

variable "project_name" {
  description = "Project prefix for resource names."
  type        = string
  default     = "streamflow"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "frontend_origin" {
  description = "Origin allowed to call the API and upload to S3. Use your Vercel URL or localhost during development."
  type        = string
  default     = "http://localhost:3000"
}

variable "admin_emails" {
  description = "Emails that should receive admin access in the app."
  type        = list(string)
  default     = []
}

variable "gemini_api_key" {
  description = "Optional Gemini API key for live companion answers."
  type        = string
  default     = ""
  sensitive   = true
}

variable "gemini_model" {
  description = "Gemini model used by the watch companion."
  type        = string
  default     = "gemma-3-27b-it"
}
