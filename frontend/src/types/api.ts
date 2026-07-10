export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  data: T;
}
