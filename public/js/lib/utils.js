function hasPermission(action, module) {
    var permission = `${action}-${module}`
    if (action == 'own') {
        if (globalThis.snpUser.id == 'root') return false;
    }

    if (globalThis.snpUser.id == 'root') return true;

    var allPerm = `${action}-all`
    return globalThis.snpUser.cargo.permissions.includes(permission)
        || globalThis.snpUser.cargo.permissions.includes(allPerm);
}

function fireEvent(target, eventName, detail) {
    const event = new CustomEvent(eventName, {
        bubbles: true,
        detail: detail,
    })
    target.dispatchEvent(event)
}


function extend(destination, ...args) {
    args.forEach((source) => {
        Object.keys(source).forEach((property) => {
            if (source[property] && isPlainObject(source[property])) {
                if (!hasOwnProperty(destination, property)) destination[property] = {};
                extend(destination[property], source[property]);
            } else if (Array.isArray(source[property])) {
                destination[property] = deepCopy(source[property]);
            } else {
                destination[property] = source[property];
            }
        });
    });

    return destination;
}

function isPlainObject(obj) {
    if (obj === null) return false;

    if (typeof obj !== "object" || obj.nodeType || obj === obj.window)
        return false;

    if (
        obj.constructor &&
        !hasOwnProperty(obj.constructor.prototype, "isPrototypeOf")
    )
        return false;

    /* Most likely |obj| is a plain object, created by {} or constructed with new Object */
    return true;
}

function hasOwnProperty(obj, key) {
    return obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function deepCopy(target) {
    return isPlainObject(target)
        ? extend({}, target)
        : Array.isArray(target)
            ? target.map(deepCopy)
            : target;
}

function trigger(el, event) {
    const e = document.createEvent("HTMLEvents");
    e.initEvent(event, true, true);
    el.dispatchEvent(e);
}

function getEventPath(event) {
    return event.path || (event.composedPath && event.composedPath())
}

function stampToDate(timestamp) {
    const date = new Date(timestamp)
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} `
        + `${new String(date.getHours()).padStart(2, '0')}:${new String(date.getMinutes()).padStart(2, '0')}`
}

function pad(number) {
    if (number < 10) {
        return '0' + number;
    }
    return number;
}

function snpalert(msg) {
    alert(msg)
}

dateToSQL = function (date) {
    // var fecha = new Date();
    // var options = { year: 'numeric', month: 'long', day: 'numeric' };
    // this._shadowRoot.getElementById('title-date').innerHTML = fecha.toLocaleDateString("es-ES", options)

    return date.getUTCFullYear() +
        '-' + pad(date.getUTCMonth() + 1) +
        '-' + pad(date.getUTCDate()) +
        ' ' + pad(date.getUTCHours()) +
        ':' + pad(date.getUTCMinutes()) // +
    // ':' + pad(date.getUTCSeconds());
};

dateToCode = function (date) {
    return `${date.getUTCFullYear() - 2000}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`
};

//Function found here: https://gist.github.com/ryanburnette/8803238
nowDate = function () {
    var d = new Date();
    d = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return d.toISOString().slice(0, -14);
}

nowDateTime = function () {
    var d = new Date();
    d = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return d.toISOString().slice(0, -8);
}

function formatMoney(x, addSign = true) {
    if(x < 0){
        return (addSign ? '-$' : '') + Math.abs(x).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ".");
    }else{
        return (addSign ? '$' : '') + x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ".");
    }
}


function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + "; SameSite=None; Secure; path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function debounce(func, delay) {
    let timeoutId;
  
    return function (...args) {
      // Clear the previous timeout
      clearTimeout(timeoutId);
  
      // Set a new timeout
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }