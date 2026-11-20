export var saveAccessToken;
export var saveRefreshToken;
export var loadAccessToken;
export var loadRefreshToken;

export function registerCallbacks(saveAccessTokencallback, saveRefreshTokenCallback, loadAccessTokenCallback, loadRefreshTokenCallback) {
	saveAccessToken = saveAccessTokencallback;
	saveRefreshToken = saveRefreshTokenCallback;
	loadAccessToken = loadAccessTokenCallback;
	loadRefreshToken = loadRefreshTokenCallback;
}