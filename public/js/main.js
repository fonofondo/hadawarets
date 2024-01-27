const filesToLoad = []


filesToLoad.push('/components.html');

filesToLoad.push('/assets/triggers.html');

$(document).ready(() => {
  	
	const snpUser = localStorage.getItem('snpUser')
	if (snpUser && !globalThis.scheme) {
		globalThis.snpUser = JSON.parse(snpUser)
		$('#login').remove()
		loadScheme()
	}else{
		
		$('#login').css('display', 'flex')
		
		const doSubmit = () => {
			const email = $.trim($('#login #user').val())
			const pass = $.trim($('#login #password').val())
			showLoginMessage('Enviando...')
			doLogin(email, pass)
		}
		
		$("#login input").on('keyup', function (e) {
			if (e.key === 'Enter' || e.keyCode === 13) {
			  doSubmit()
			}
		});
		
		$('#login button').click(doSubmit)
	}
	
})

function doLogin(email, pass) {
  callSnpApi('initLogin', { user: email, password: pass }, (data) => {
    if ('id' in data && data.id) {
      // setCookie('snpUserName', email)
      // setCookie('snpPass', pass)
      globalThis.snpUser = data
      localStorage.setItem('snpUser', JSON.stringify(globalThis.snpUser));
      $('#login').remove()
      loadScheme()
    } else {
      $('#login').css('display', 'flex')
      showLoginMessage('Datos incorrectos.');
    }
  }, (jqXHR, textStatus, errorThrown) => {
	  showLoginMessage('Error de conexión.');
  })
}

function showLoginMessage(msg) {
  $('#login .msg').html(msg).show()
}

function loadScheme() {
  jQuery.getJSON('/api/v1//scheme', (scheme) => {
    globalThis.scheme = scheme
    globalThis.appName = scheme.appName
    loadAppFiles()
  })
}

const loadAppFiles = async function () {
  var landingLoader = document.createElement('snp-landing-loader')
  document.body.appendChild(landingLoader)
  landingLoader.init(filesToLoad.length - 1)

  const loadPromises = []
  filesToLoad.forEach((filePath) => {
    loadPromises.push(() => {
      return new Promise((resolve) => {
        jQuery('#app').load(filePath, () => {
          landingLoader.stepUp()
          resolve()
        })
      })
    })
  })

  //const reponse = await Promise.all(loadPromises)
  for (loadPromise of loadPromises) {
    await loadPromise()
  }

  landingLoader.remove()
  await init()
}


const loader = document.createElement('snp-growl')
const layout = document.createElement('snp-layout')

const init = async () => {
  layout.setAttribute('id', 'main-layout')
  jQuery('body').append(loader);
  jQuery('#app').append(layout);

  fireEvent(document, 'snpInit', globalThis.scheme)

  document.title = globalThis.scheme.settings.system_name

  // if ('serviceWorker' in navigator) {
  //   await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  //   await navigator.serviceWorker.ready
  // }

  snpdb.sync() //{ forceHistory: true }
}

window.addEventListener('online', () => {
  loader.setAttribute('message', 'Conectando...')
  setTimeout(() => {
    snpdb.sync()
  }, 8000)
});

window.addEventListener('offline', () => {
  loader.setAttribute('message', 'Sin conexión')
});

callSnpApi = function (url, data, callback, errorCallback, progressCb) {
  $.ajax({
    url: url.match(/^http/) ? url : "/api/v1/" + url,
    type: "POST",
    // contentType: "application/json;charset=utf8",
    data: data,
    cache: false,
    success: function (response) {
      if (callback) callback(response ? response : false);
      if (loader.message == 'Sin conexión') {
        loader.setAttribute('message', '')
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      if (errorCallback) errorCallback(jqXHR, textStatus, errorThrown);
      loader.setAttribute('message', 'Sin conexión')
    },
    xhr: function () {
      var myXhr = $.ajaxSettings.xhr();
      if (myXhr.upload) {
        // For handling the progress of the upload
        myXhr.upload.addEventListener(
          "progress",
          function (e) {
            if (e.lengthComputable) {
              var percent = Math.round((e.loaded / e.total) * 100);
              if (progressCb) progressCb(percent);
            }
          },
          false
        );
      }
      return myXhr;
    },
  });
};

function snpReplicate(originHost) {
  callSnpApi(originHost + "/api/v1/sync", {
    lastSyncTime: 0,
    docs: [],
    silent: false
  }, async (response) => {

    response.docs.forEach((doc, index) => {
      response.docs[index].synced = 0
      response.docs[index].creator = response.docs[index].creator.snpId
    })

    snpdb.dbDriver.upsertDocs(response.docs || []).then((upsertedDocs) => {
      snpdb.sync()
    })
  }, (jqXHR, textStatus, errorThrown) => {
    console.error(errorThrown, []);
  });
}


var socket
function setupSocket() {


  // socket = io.connect('https://' + window.location.hostname);

  // socket.on("sync", async () => {
  //   console.log('socket sync')
  //   snpdb.sync()
  // });

  // socket.on("disconnect", (reason) => {
  //   if (reason === "io server disconnect") {
  //     socket.connect(t.baseUrl);
  //   }
  //   console.log("Socket disconnected, attempting reconnect...");
  // });

  // socket.on("reconnect", (reason) => {
  //   console.log("socket reconect");
  //   snpdb.sync()
  // });
};

setupSocket()

