const tokenArgument = process.argv.find(argument => argument.startsWith('--freellmapi-dashboard-token='))
if (tokenArgument !== undefined) {
  try {
    window.localStorage.setItem(
      'freellmapi_dashboard_token',
      tokenArgument.slice('--freellmapi-dashboard-token='.length),
    )
  } catch {
    // The dashboard will show its login surface if storage is unavailable.
  }
}
