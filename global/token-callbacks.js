export var saveAccessToken;
export var saveRefreshToken;

export function registerCallbacks(saveAccessTokencallback, saveRefreshTokenCallback) {
	saveAccessToken = saveAccessTokencallback;
	saveRefreshToken = saveRefreshTokenCallback;
}