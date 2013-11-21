(function () {
	var cardTypes = {
		'photo': {
			matcher: /class=\"u-block\" src=\"([^\"]+)\"/i
		},
		'player': {
			matcher: /<div id=\"ExternalIframeContainer\"[^>]+>[^<]+<iframe src=\"([^\"]+)"[^>]+>/i
		}
	};

	function getPreview(event) {
		var data = event.data;
		// We only accept messages from ourselves
		if (event.source != window) {
			return;
		}

		if (data.customEvt && (data.customEvt == "uiPrevieweetRequested")) {
			getPreviewFromCard(data, function (previewSrc) {
				try {
					window.postMessage({
						customEvt: 'dataHasPrevieweet',
						type: data.type,
						src: previewSrc,
						itemId: data.itemId
					}, '*');
				} catch (e) {}
			});
		}
	}

	function getPreviewFromCard(data, callback) {
		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function () {
			var preview;

			if (xhr.readyState !== 4) {
				return;
			}

			for (var type in cardTypes) {
				if (!cardTypes.hasOwnProperty(type)) {
					continue;
				}

				preview = xhr.responseText.match(cardTypes[type].matcher);

				if (preview && preview[1] && typeof callback == 'function') {
					callback(preview[1]);
					return;
				}
			}
		};
		xhr.open("GET", data.url, true);
		xhr.send();
	}

	window.addEventListener('message', getPreview, false);

	// inject the extension into the page
	var target = document.querySelectorAll('.swift-boot-module');
	if (target.length > 0) {
		target = target[0];
	} else {
		target = document.getElementById('swift-module-path');
	}
	input = document.createElement('input');
	input.value = chrome.extension.getURL('previeweetCore.js');
	input.type = 'hidden';
	input.className = 'swift-boot-module';
	target.parentNode.insertBefore(input, target);
}());