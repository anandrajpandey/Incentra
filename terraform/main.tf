locals {
  name_prefix = "${var.project_name}-${var.environment}"
  frontend_origins = distinct([
    trimspace(var.frontend_origin),
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ])
}

resource "random_id" "suffix" {
  byte_length = 3
}

resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

resource "aws_s3_bucket" "videos" {
  bucket = "${local.name_prefix}-videos-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "videos" {
  bucket = aws_s3_bucket.videos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "videos" {
  bucket = aws_s3_bucket.videos.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = local.frontend_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_cloudfront_origin_access_control" "videos" {
  name                              = "${local.name_prefix}-oac"
  description                       = "Origin access control for StreamFlow video bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "videos_cors" {
  name = "${local.name_prefix}-videos-cors"

  cors_config {
    access_control_allow_credentials = false

    access_control_allow_headers {
      items = ["*"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }

    access_control_allow_origins {
      items = local.frontend_origins
    }

    access_control_expose_headers {
      items = ["Content-Length", "Content-Range", "ETag"]
    }

    access_control_max_age_sec = 600
    origin_override            = true
  }
}

resource "aws_cloudfront_distribution" "videos" {
  enabled             = true
  default_root_object = ""

  origin {
    domain_name              = aws_s3_bucket.videos.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.videos.id
    origin_id                = "streamflow-video-origin"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "streamflow-video-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.videos_cors.id

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "videos_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.videos.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.videos.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "videos" {
  bucket = aws_s3_bucket.videos.id
  policy = data.aws_iam_policy_document.videos_bucket.json
}

resource "aws_dynamodb_table" "videos" {
  name         = "${local.name_prefix}-videos"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "comments" {
  name         = "${local.name_prefix}-comments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "videoId"
  range_key    = "commentId"

  attribute {
    name = "videoId"
    type = "S"
  }

  attribute {
    name = "commentId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "user_profiles" {
  name         = "${local.name_prefix}-user-profiles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "users" {
  name         = "${local.name_prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  attribute {
    name = "username"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "recent_watch" {
  name         = "${local.name_prefix}-recent-watch"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "watchedAt"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "watchedAt"
    type = "S"
  }
}

resource "aws_dynamodb_table" "subtitle_analyses" {
  name         = "${local.name_prefix}-subtitle-analyses"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "videoId"

  attribute {
    name = "videoId"
    type = "S"
  }
}

resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_app" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.videos.arn,
          aws_dynamodb_table.comments.arn,
          aws_dynamodb_table.user_profiles.arn,
          aws_dynamodb_table.users.arn,
          aws_dynamodb_table.recent_watch.arn,
          aws_dynamodb_table.subtitle_analyses.arn,
          "${aws_dynamodb_table.users.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.videos.arn}/*"
      }
    ]
  })
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../backend/dist/index.js"
  output_path = "${path.module}/build/streamflow-backend.zip"
}

resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  role          = aws_iam_role.lambda.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout       = 29
  memory_size   = 1024

  environment {
    variables = {
      VIDEOS_TABLE_NAME        = aws_dynamodb_table.videos.name
      COMMENTS_TABLE_NAME      = aws_dynamodb_table.comments.name
      USER_PROFILES_TABLE_NAME = aws_dynamodb_table.user_profiles.name
      USERS_TABLE_NAME         = aws_dynamodb_table.users.name
      RECENT_WATCH_TABLE_NAME  = aws_dynamodb_table.recent_watch.name
      SUBTITLE_ANALYSES_TABLE_NAME = aws_dynamodb_table.subtitle_analyses.name
      UPLOAD_BUCKET_NAME       = aws_s3_bucket.videos.bucket
      CLOUDFRONT_DOMAIN        = "https://${aws_cloudfront_distribution.videos.domain_name}"
      FRONTEND_ORIGIN          = join(",", local.frontend_origins)
      ADMIN_EMAILS             = join(",", var.admin_emails)
      AUTH_TOKEN_SECRET        = random_password.auth_secret.result
      GEMINI_API_KEY           = var.gemini_api_key
      GEMINI_MODEL             = var.gemini_model
    }
  }
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name_prefix}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type", "authorization"]
    allow_methods = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    allow_origins = local.frontend_origins
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowHttpApiInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
