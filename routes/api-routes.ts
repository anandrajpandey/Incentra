export const apiRoutes = [
  {
    method: 'GET',
    path: '/videos',
    handler: 'lambda/listVideosHandler',
    description: 'List catalog videos, optionally filtered by category.',
  },
  {
    method: 'GET',
    path: '/videos/{id}',
    handler: 'lambda/getVideoHandler',
    description: 'Return a single video by id.',
  },
  {
    method: 'POST',
    path: '/upload-url',
    handler: 'lambda/createUploadUrlHandler',
    description: 'Generate an S3 pre-signed upload URL.',
  },
  {
    method: 'POST',
    path: '/videos',
    handler: 'lambda/createVideoHandler',
    description: 'Persist video metadata in DynamoDB.',
  },
  {
    method: 'PATCH',
    path: '/videos/{id}',
    handler: 'lambda/updateVideoHandler',
    description: 'Update selected video metadata.',
  },
  {
    method: 'DELETE',
    path: '/videos/{id}',
    handler: 'lambda/deleteVideoHandler',
    description: 'Delete a video record.',
  },
  {
    method: 'GET',
    path: '/admin/stats',
    handler: 'lambda/adminStatsHandler',
    description: 'Return lightweight dashboard stats.',
  },
]
