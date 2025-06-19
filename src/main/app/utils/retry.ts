type RetryFn<T> = () => T | Promise<T>

/**
 * A utility that retries a function until it succeeds or the maximum number of retries is reached.
 *
 * @param fn - A function to execute and retry on failure.
 * @param interval - The time interval (in milliseconds) between each retry. Defaults to 1000.
 * @param maxRetries - The maximum number of retry attempts. Defaults to 3.
 * @param backoff - The backoff strategy to use: 'linear', 'exponential', or null.
 * @returns {Promise<T>} - A promise that resolves to the result of the function.
 * @throws {Error} - Throws the last error if all retry attempts fail.
 */
export async function retry<T>(
  fn: RetryFn<T>,
  interval: number = 1000,
  maxRetries: number = 3,
  backoff: 'exponential' | 'linear' | null = 'linear',
): Promise<T> {
  let attempt = 0
  let lastError: any = null

  while (attempt < maxRetries) {
    attempt++
    try {
      console.log(`Retry attempt ${attempt}/${maxRetries}`)
      const result = await fn()
      console.log(`Success on attempt ${attempt}`)
      return result
    } catch (error) {
      console.error(`Error on attempt ${attempt}:`, error)
      lastError = error

      // 마지막 시도에서 에러가 발생하면 에러를 던짐
      if (attempt === maxRetries) {
        console.error(`All ${maxRetries} attempts failed. Throwing last error.`)
        throw error
      }

      // Wait for the specified interval before the next attempt
      let computedInterval = interval

      if (backoff === 'linear') {
        computedInterval = interval * attempt
      } else if (backoff === 'exponential') {
        computedInterval = Math.pow(2, attempt - 1) * interval
        computedInterval = Math.min(computedInterval, 30000) // Cap the maximum interval to 30 seconds
      }

      console.log(`Waiting ${computedInterval}ms before next attempt...`)
      await new Promise<void>(resolve => setTimeout(resolve, computedInterval))
    }
  }

  // 이 코드에는 도달하지 않지만 TypeScript를 위해 추가
  throw lastError || new Error('All retry attempts failed')
}
