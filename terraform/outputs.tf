output "api_base_url" {
  description = "HTTP API base URL for NEXT_PUBLIC_API_BASE_URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "cloudfront_base_url" {
  description = "CloudFront base URL for NEXT_PUBLIC_CLOUDFRONT_BASE_URL"
  value       = "https://${aws_cloudfront_distribution.videos.domain_name}"
}

output "videos_bucket_name" {
  value = aws_s3_bucket.videos.bucket
}

output "videos_table_name" {
  value = aws_dynamodb_table.videos.name
}

output "comments_table_name" {
  value = aws_dynamodb_table.comments.name
}

output "user_profiles_table_name" {
  value = aws_dynamodb_table.user_profiles.name
}

output "users_table_name" {
  value = aws_dynamodb_table.users.name
}

output "recent_watch_table_name" {
  value = aws_dynamodb_table.recent_watch.name
}

output "subtitle_analyses_table_name" {
  value = aws_dynamodb_table.subtitle_analyses.name
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}
