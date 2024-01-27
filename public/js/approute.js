let snpdomain = /:\/\/([^\/]+)/.exec(window.location.href)[1].split('.')[0];
if (snpdomain == 'laestrellita') {
    snpdomain = 'v2dev'
}
const appName = snpdomain
