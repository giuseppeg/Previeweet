// Copyright (c) 2012 Giuseppe Gurgone

// This work is licensed for reuse under the MIT license.
// See the license file for details https://github.com/giuseppeg/Previeweet/blob/master/LICENSE

// https://github.com/giuseppeg/Previeweet

(function () {

    'use strict';

    // Url Resolver Module
    define("previeweet/url_resolver", ["module"], function (m) {

        function UrlResolver() {

            this.resolveLink = function (elem, url) {
                clearTimeout(this.batch);

                var elems = this.linksToResolve[url] || [];
                elems.push(elem);
                this.linksToResolve[url] = elems;

                this.batch = setTimeout(this.sendBatchRequest.bind(this), 0);
            };

            this.sendBatchRequest = function () {

                var that = this,
                    urls = Object.keys(this.linksToResolve);

                if (urls.length === 0) {
                    return;
                }

                $.ajax({
                    data: {
                        urls: urls
                    },
                    url: "/i/resolve.json",
                    headers: {
                        "X-PHX": true
                    },
                    dataType: "json",
                    success: function (data) {

                        Object.keys(data).forEach(function (url) {
                            if (that.linksToResolve[url]) {
                                that.linksToResolve[url].forEach(function (elem) {
                                    elem.trigger("previeweetWantsLinkResolution", {
                                        url: data[url]
                                    });
                                }, that);
                            }

                            delete that.linksToResolve[url];
                        }, that);

                    }
                });
            };

            this.linksToResolve = {};
        }

        m.exports = UrlResolver;
    });

    // Twitter's Phoenix Shim, customized.
    // I also think that Twitter will kill this at some point. It is a Shim anyway :)
    define("previeweet/phx", ["module"], function (m) {

        var mediaTypes = {},
            matchers = [],
            twttr = {
                media: {
                    types: {}
                },
                isSSL: function () {
                    return (/^https:\/\//).test(window.location.href);
                },
                mediaType: function (name, data) {
                    var that = this,
                        matcher,
                        m;

                    mediaTypes[name] = data;

                    if (!data.title) {
                        mediaTypes[name].title = name;
                    }

                    for (matcher in data.matchers) {
                        if (data.matchers.hasOwnProperty(matcher)) {
                            m = data.matchers[matcher];

                            data.matchers[matcher] = m;
                            data._name = name;
                            matchers.push([m, name, matcher]);
                        }
                    }

                    that.media.types[name] = {
                        matchers: data.matchers,
                        statics: function (obj) {
                            mediaTypes[name].statics = obj;
                            mediaTypes[name] = that.util.merge(mediaTypes[name], obj);
                            that.media.types[name].templates = obj.templates;
                            return this;
                        },
                        methods: function (obj) {
                            mediaTypes[name].methods = obj;
                            mediaTypes[name] = that.util.merge(mediaTypes[name], obj);
                            return this;
                        }
                    };

                    return that.media.types[name];
                },
                getImageURL: function (template, data, callback) {
                    if (!template || !data || !callback) {
                        return;
                    }

                    var imgSrc = this.util.supplant(template, data);

                    if (imgSrc) {
                        callback(imgSrc);
                    }

                    callback(null);
                },
                util: {
                    bind: function (context, fn, args) {
                        return function () {
                            return fn.apply(context, args ? args.concat(Array.prototype.slice.apply(arguments)) : arguments);
                        };
                    },
                    merge: function () {
                        var array = $.makeArray(arguments);

                        if (array.length === 1) {
                            array = array[0];
                        } else {
                            if (typeof array[array.length - 1] === "boolean") {
                                array.unshift(array.pop());
                            }
                        }

                        return $.extend.apply(null, array);
                    },
                    // Extract the query string paramenters from facebook's urls
                    // The Twitter's version is buggy.
                    paramsFromUrl: function (url) {
                        if (!url || url.indexOf("?") < 0) {
                            return null;
                        }

                        var params = {};

                        // The argument of the function is an URL
                        // which is splitted into ["ttp://www.b.ar/?foo1=val1", "foo2=val2", "foo3=val3"] after url.slice(1)
                        // you got the point ;)
                        // fix:
                        if (url[0] !== "?") {
                            url = url.substr(url.indexOf("?"), url.length);
                        }

                        url.slice(1).split("&").forEach(function (param) {
                            var parts = param.split("=");
                            params[parts[0]] = parts[1];
                        });

                        return params;
                    },
                    supplant: function (template, data, strict) {
                        var resolved = template,
                            m = template.match(/\{\{([^\}]+)\}\}/g),
                            i,
                            item,
                            key;

                        if (!strict) {
                            strict = true;
                        }

                        for (i = 0; m[i]; i += 1) {
                            item = m[i];
                            key = item.replace(/\{|\}/g, '');
                            if (data[key]) {
                                resolved = resolved.replace(item, data[key]);
                            } else {
                                if (strict) {
                                    return false;
                                }
                            }
                        }
                        return resolved;
                    }
                }
            },
            sandboxedAjax = {
                sandboxes: {
                    jsonp: "https://si0.twimg.com/a/1351295865/jsonp_sandbox.html"
                },
                send: function () {
                    throw new Error("you have to define sandboxedAjax.send");
                },
                oembed: function (url, data, callback) {
                    this.send({
                        url: url,
                        dataType: "jsonp",
                        data: twttr.util.merge(data, {
                            maxwidth: 120
                        }),
                        success: function (data) {
                            if (!data.error) {
                                var thumbnail = data.thumbnail_url || data.thumbnail || null,
                                    img;

                                if (!thumbnail && data.html) {
                                    img = $(data.html).find("img").first();

                                    if (img.length) {
                                        thumbnail = img.attr("src");
                                    }
                                }

                                callback(thumbnail);
                            }

                            callback(null);
                        }
                    });
                }
            };

        m.exports = {
            mediaTypes: mediaTypes,
            matchers: matchers,
            twttr: twttr,
            sandboxedAjax: sandboxedAjax
        };
    });

    provide("previeweet/media/types", function (exp) {
        using("previeweet/phx", function (phx) {
            var twttr = phx.twttr,
                fixProtocol = function (url) {
                    return twttr.isSSL() ? url.replace(/^http:/, "https:") : url;
                };

            twttr.mediaType("Instagram", {
                title: "Instagram",
                domain: "//instagr.am",
                icon: "//instagram.com/favicon.ico",
                username: "instagram",
                matchers: {
                    photo: /(?:instagr\.am|instagram\.com)\/p\/([a-zA-Z0-9_\-]+)\/?/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    twttr.getImageURL(this.constructor.template, {
                        domain: this.domain,
                        slug: this.slug,
                        size: that.constructor.size
                    }, callback);
                }
            }).statics({
                template: "{{domain}}/p/{{slug}}/media/?size={{size}}",
                size: "t"
            });

            twttr.mediaType("Twitter", {
                title: "Twitter",
                domain: "//twitter.com",
                icon: "//twitter.com/favicon.ico",
                username: "twitter",
                preEmbed: true,
                matchers: {
                    photo: /^pic\.twitter\.com\/(\w+)[\/]?$/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    this.process(function () {
                        if (that.data && that.data.src) {
                            callback(that.data.src);
                        }

                        callback(null);
                    });
                },
                process: function (callback) {
                    var that = this;

                    phx.sandboxedAjax.send({
                        url: "//api.twitter.com/1/statuses/show.json",
                        dataType: "jsonp",
                        data: {
                            id: that.slug,
                            include_entities: true
                        },
                        success: function (data) {
                            var i,
                                media;

                            if (!data || !data.entities || !data.entities.media) {
                                callback();
                            }

                            for (i = 0; data.entities.media[i]; i += 1) {
                                media = data.entities.media[i];
                                if (media.type === "photo") {
                                    that.data.src = media.media_url_https || media.media_url_http;
                                    callback();
                                }
                            }
                        },
                        error: callback
                    });
                }
            });

            twttr.mediaType("YFrog", {
                title: "YFrog",
                domain: "//yfrog.com",
                icon: "//yfrog.com/images/favicon.png",
                username: "yfrog",
                matchers: {
                    photo: /yfrog\.(?:com|ru|com\.tr|it|fr|co\.il|co\.uk|com\.pl|pl|eu|us)\/(\w+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    twttr.getImageURL(this.constructor.template, {
                        domain: this.domain,
                        slug: this.slug,
                        size: that.constructor.size
                    }, callback);
                }
            }).statics({
                template: "{{domain}}/{{slug}}:{{size}}",
                size: "small"
            });

            twttr.mediaType("YouTube", {
                title: "YouTube",
                domain: "//img.youtube.com",
                icon: "//youtube.com/favicon.ico",
                username: "youtube",
                matchers: {
                    tinyUrl: /youtu\.be\/([\w\-]+)/i,
                    standardUrl: /youtube\.com\/watch[a-zA-Z0-9_\-\?\&\=\/]+/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    this.process(function () {
                        if (that.data && that.data.src) {
                            callback(that.data.src);
                        } else {
                            callback(null);
                        }
                    });
                },
                process: function (callback) {
                    var tiny = this.url.match(this.constructor.matchers.tinyUrl),
                        standard = this.url.match(/[\?\&]v\=([\w\-]+)\&?/);

                    if (!tiny && standard) {
                        this.slug = standard[1];
                    } else {
                        callback();
                    }

                    this.data.src = twttr.util.supplant(this.constructor.template, {
                        domain: this.domain,
                        slug: this.slug
                    });

                    callback();
                }
            }).statics({
                template: "{{domain}}/vi/{{slug}}/0.jpg"
            });

            twttr.mediaType("Ustream", {
                title: "Ustream",
                domain: "//ustream.tv",
                icon: "http://static-cdn1.ustream.tv/images/favicon-blue:1.ico",
                username: "Ustream",
                resolveTinyUrl: true,
                matchers: {
                    tinyUrl: /ustre.am\/.*/i,
                    recorded: /ustream\.tv\/(recorded\/(?:\d+))/i,
                    channel: /ustream\.tv\/(channel\/(?:[\w\-]+)\/?)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    this.process(function () {
                        if (that.data && that.data.src) {
                            callback(that.data.src);
                        } else {
                            callback(null);
                        }
                    });
                },
                process: function (callback) {
                    var that = this;

                    if (this.slug.match(this.constructor.re.channel) || this.slug.match(this.constructor.re.video)) {
                        phx.sandboxedAjax.send({
                            url: "http://api.ustream.tv/json/channel/" + RegExp.$1 + "/getInfo",
                            dataType: "jsonp",
                            data: {
                                key: that.constructor.API_KEY
                            },
                            success: function (data) {
                                if (data !== null && data.imageUrl && data.imageUrl.small) {
                                    that.data.src = data.imageUrl.small;
                                }
                                callback();
                            }
                        });
                    }
                }
            }).statics({
                API_KEY: "12ab548e85128e0d3182ba3a346c3428",
                re: {
                    video: /^recorded\/(\d+)/,
                    channel: /^channel\/([\w\-]+)\/?/
                }
            });

            twttr.mediaType("Flickr", {
                title: "Flickr",
                domain: twttr.isSSL() ? "https://secure.flickr.com" : "http://www.flickr.com",
                icon: twttr.isSSL() ? "https://secure.flickr.com/favicon.ico" : "http://www.flickr.com/favicon.ico",
                username: "Flickr",
                deciderKey: "phoenix_flickr_details",
                resolveTinyUrl: true,
                matchers: {
                    tinyUrl: /flic\.kr\/(?:p|s|g|y|ps)\/([0-9a-zA-Z]+)\/?/i,
                    profile: /flickr\.com\/\#?\/?(?:photos|people)\/([\w\@\-]+)\/?$/i,
                    photo: /flickr\.com\/\#?\/?photos\/[\w\@\-]+\/(\d+)\/?/i,
                    sets: /flickr\.com\/\#?\/?photos\/(?:[\w\@\-]+)\/sets\/(\d+)\/?(?:show\/?)?$/i,
                    galleries: /flickr\.com\/\#?\/?photos\/([\w\@\-]+)\/galleries\/(\d+)\/?$/i,
                    pool: /flickr\.com\/\#?\/?groups\/([\w\@\-]+)\/?(?:pool\/|discuss\/)?$/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    this.process(function () {
                        that.createImgSrc(function (img) {
                            if (img) {
                                callback(img);
                            }

                            callback(null);
                        });
                    });
                },
                process: function (callback) {
                    var that = this,
                        url = this.url,
                        matchers = twttr.media.types.Flickr.matchers,
                        photo_id;

                    this.data.domain = this.constructor.domain;

                    if (url.match(matchers.photo)) {

                        photo_id = RegExp.$1;
                        this.makeRequest({
                            data: {
                                method: "flickr.photos.getInfo",
                                photo_id: photo_id
                            },
                            success: function (data) {
                                if (data.photo) {
                                    that.data.photo = data.photo;
                                }
                                callback();
                            }
                        });

                    } else if (url.match(matchers.sets)) {

                        this._makeSetRequest(RegExp.$1, callback);

                    } else if (url.match(matchers.profile)) {

                        this.lookUpUserPhotos(RegExp.$1, this.slug, callback);

                    } else if (url.match(matchers.pool)) {

                        this._makeGroupRequestByName(RegExp.$1, callback);

                    } else {

                        if (url.match(matchers.galleries)) {

                            this.makeRequest({
                                data: {
                                    method: "flickr.urls.lookupGallery",
                                    url: "flickr.com/photos/" + RegExp.$1 + "/galleries/" + RegExp.$2
                                },
                                success: function (data) {
                                    var gallery_id = data.gallery.id;

                                    that.makeRequest({
                                        data: {
                                            method: "flickr.galleries.getPhotos",
                                            gallery_id: gallery_id
                                        },
                                        success: function (data) {
                                            if (data.photos && data.photos.photo.length >= 1) {
                                                var photo = data.photos.photo.slice(0, 1);
                                                that.data.photo = photo[0];
                                            }
                                            callback();
                                        }
                                    });
                                }
                            });

                        }

                    }

                    return;
                }
            }).statics({
                API_KEY: "2a56884b56a00758525eaa2fee16a798",
                SECRET: "7c794fe3256175b6",
                REST_DOMAIN: "//widgets.platform.twitter.com",
                template: "//farm{{farm}}.static.flickr.com/{{server}}/{{id}}_{{secret}}{{size}}.jpg"
            }).methods({
                lookUpUserPhotos: function (user, slug, callback) {

                    var that = this;

                    this.makeRequest({
                        data: {
                            method: "flickr.urls.lookupUser",
                            url: "flickr.com/photos/" + user
                        },
                        success: function (data) {

                            if (data.stat === "fail") {
                                callback();
                            }

                            var user_id = data.user.id;

                            that.makeRequest({
                                data: {
                                    method: "flickr.people.getPublicPhotos",
                                    user_id: user_id
                                },
                                success: function (data) {
                                    if (data.photos.photo.length >= 1) {
                                        var photo = data.photos.photo.slice(0, 1);
                                        that.data.photo = photo[0];
                                    }
                                    callback();
                                }
                            });

                        }
                    });

                },
                _makeGroupRequestByName: function (group_name, callback) {

                    this.makeRequest({
                        data: {
                            method: "flickr.urls.lookupGroup",
                            url: "flickr.com/groups/" + group_name
                        },
                        success: twttr.util.bind(this, function (data) {
                            this._makeGroupRequestById(data.group.id, callback);
                        })
                    });

                },
                _makeGroupRequestById: function (group_id, callback) {

                    this.makeRequest({
                        data: {
                            method: "flickr.groups.pools.getPhotos",
                            group_id: group_id
                        },
                        success: twttr.util.bind(this, function (data) {
                            if (data.photos.photo.length >= 1) {
                                var photo = data.photos.photo.slice(0, 1);
                                this.data.photo = photo[0];
                            }
                            callback();
                        })
                    });

                },
                _makeSetRequest: function (photoset_id, callback) {

                    this.makeRequest({
                        data: {
                            method: "flickr.photosets.getPhotos",
                            photoset_id: photoset_id
                        },
                        success: twttr.util.bind(this, function (data) {
                            var photo = data.photoset.photo.slice(0, 1);
                            this.data.photo = photo[0];

                            callback();
                        })
                    });

                },
                makeRequest: function (settings) {

                    var default_settings = {
                        url: this.constructor.statics.REST_DOMAIN + "/services/rest",
                        dataType: "jsonp",
                        jsonp: "jsoncallback",
                        data: {
                            format: "json",
                            api_key: this.constructor.statics.API_KEY
                        },
                        success: function (data) {}
                    };

                    phx.sandboxedAjax.send(twttr.util.merge({}, default_settings, settings, true));

                },
                createImgSrc: function (callback) {

                    var that = this,
                        photo = this.data.photo;

                    if (photo) {
                        callback(twttr.util.supplant(that.constructor.template, {
                            farm: photo.farm,
                            server: photo.server,
                            id: photo.id,
                            secret: photo.secret,
                            size: "_s"
                        }));
                    }

                    callback(null);
                }
            });

            twttr.mediaType("DeviantArt", {
                title: "DeviantArt",
                domain: "//deviantart.com",
                icon: "//deviantart.com/favicon.ico",
                username: "deviantART",
                resolveTinyUrl: true,
                matchers: {
                    tinyUrl: /dlvr\.it\/([a-zA-Z0-9]+)/i,
                    canonical: /((?:[\w\-]+\.)deviantart\.com\/art\/(?:[\w\@\-]+))/i,
                    oldStyle: /((?:[\w\-]+\.)deviantart\.com\/deviation\/(?:[\w\@\-]+))/i,
                    gallery: /((?:[\w\-]+\.)deviantart\.com\/gallery\/#\/d(?:[\w\@\-]+))/i,
                    favMe: /(fav\.me\/(?:[\w\@\-]+))/i,
                    oldView: /((?:[\w\-]+\.)deviantart\.com\/view\/(?:[\w\@\-]+))/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("//backend.deviantart.com/oembed", {
                        format: "jsonp",
                        url: this.slug
                    }, callback);
                }
            });

            twttr.mediaType("Vimeo", {
                title: "Vimeo",
                domain: "//vimeo.com",
                icon: "//vimeo.com/favicon.ico",
                username: "vimeo",
                matchers: {
                    video: /vimeo\.com\/(\d+)/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("//vimeo.com/api/oembed.json", {
                        format: "jsonp",
                        url: "http://vimeo.com/" + this.slug
                    }, callback);
                }
            });

            twttr.mediaType("Photozou", {
                title: "Photozou",
                domain: "//photozou.jp",
                icon: "//photozou.jp/favicon.ico",
                username: "photozou",
                matchers: {
                    photo: /photozou\.(?:com|jp)\/photo\/show\/\d+\/(\d+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    twttr.getImageURL(this.constructor.template, {
                        domain: this.domain,
                        slug: this.slug
                    }, callback);
                }
            }).statics({
                template: "http://{{domain}}/p/thumb/{{slug}}"
            });

            twttr.mediaType("TwitPic", {
                title: "TwitPic",
                domain: "//twitpic.com",
                icon: "//twitpic.com/images/favicon.ico",
                username: "TwitPic",
                matchers: {
                    media: /twitpic\.com\/(?!(?:place|photos|events)\/)([a-zA-Z0-9\?\=\-]+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    twttr.getImageURL(this.constructor.template, {
                        domain: this.domain,
                        slug: this.slug,
                        size: that.constructor.size
                    }, callback);
                }
            }).statics({
                template: "//{{domain}}/show/{{size}}/{{slug}}",
                size: "mini"
            });

            twttr.mediaType("Twitgoo", {
                title: "Twitgoo",
                domain: "twitgoo.com",
                icon: "http://twitgoo.com/images/favicon.png",
                username: "twitgoo",
                matchers: {
                    image: /twitgoo\.com\/(?!a\/)([a-zA-Z0-9\-\?\=]+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    twttr.getImageURL(this.constructor.template, {
                        domain: this.domain,
                        slug: this.slug
                    }, callback);
                }
            }).statics({
                template: "http://{{domain}}/{{slug}}/img"
            });

            twttr.mediaType("DailyBooth", {
                title: "DailyBooth",
                domain: "dailybooth.com",
                icon: "http://dailybooth.com/favicon.ico",
                username: "dailybooth",
                matchers: {
                    photo1: /dailybooth\.com\/(u\/\w+)/i,
                    photo2: /dailybooth\.com\/(\w+\/\w+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    this.process(function () {
                        if (that.data && that.data.src) {
                            callback(that.data.src);
                        } else {
                            callback(null);
                        }
                    });
                },
                process: function (callback) {
                    var that = this,
                        id,
                        picture_id;

                    if (this.slug.match(/^u\/(\w+)/)) {

                        id = parseInt(RegExp.$1, 36);
                        picture_id = this.getBaseTen(id);

                    } else {

                        picture_id = this.slug.match(/\w+\/(\w+)/);

                        if (!picture_id) {
                            callback();
                            return;
                        }

                        picture_id = picture_id[1];

                    }

                    phx.sandboxedAjax.send({
                        url: "http://api.dailybooth.com/v1/picture/" + picture_id + ".json",
                        dataType: "jsonp",
                        type: "get",
                        success: function (data) {
                            that.data.src = fixProtocol(data.urls.small);
                            callback();
                        }
                    });
                }
            }).methods({
                getBaseTen: function (num) {
                    if (Number.prototype.toFixed) {
                        num = num.toFixed(5);
                        num = parseFloat(num);
                    } else {
                        var floor = Math.floor(num),
                            diff = num - floor;

                        num = floor + Math.round(diff * 1e14) / 1e14;
                    }

                    return num;
                }
            });

            twttr.mediaType("Lockerz", {
                title: "Lockerz",
                domain: "//www.lockerz.com",
                icon: "//lockerz.com/favicon.ico",
                username: "lockerz",
                matchers: {
                    tweetphoto: /tweetphoto\.com\/(\d+)/i,
                    plixi: /(?:(?:m|www)\.)?plixi\.com\/p\/(\d+)/i,
                    lockerz: /(?:(?:m|www)\.)?lockerz\.com\/s\/([0-9\?\=\- ]+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    twttr.getImageURL(this.constructor.template, {
                        domain: this.domain,
                        url: encodeURIComponent(this.url),
                        size: that.constructor.size
                    }, callback);
                }
            }).statics({
                template: "//api.plixi.com/api/tpapi.svc/imagefromurl?size={{size}}&amp;url={{url}}",
                size: "small"
            });

            twttr.mediaType("Kiva", {
                title: "Kiva",
                domain: "//www.kiva.org",
                icon: "//www.kiva.org/favicon.ico",
                username: "Kiva",
                matchers: {
                    project: /kiva\.org\/lend\/(\d+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    this.process(function () {
                        if (that.data && that.data.src) {
                            callback(that.data.src);
                        } else {
                            callback(null);
                        }
                    });
                },
                process: function (callback) {
                    var that = this;

                    phx.sandboxedAjax.send({
                        url: "//www.kiva.org/services/oembed",
                        dataType: "jsonp",
                        jsonp: "jsonp",
                        data: {
                            url: "http://www.kiva.org/lend/" + this.slug,
                            format: "jsonp"
                        },
                        success: function (data) {
                            if (data && data.html) {
                                var img = $(data.html).find("img").first();

                                if (img.length) {
                                    that.data.src = img.attr("src");
                                }
                            }
                            callback();
                        }
                    });
                }
            });

            twttr.mediaType("TwitVid", {
                title: "TwitVid",
                domain: "www.twitvid.com",
                icon: "//www.twitvid.com/favicon.ico",
                username: "TwitVid",
                matchers: {
                    video: /twitvid\.com\/([a-zA-Z0-9_\-\?\=]+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    twttr.getImageURL(this.constructor.template, {
                        domain: this.domain,
                        media_id: this.slug
                    }, callback);
                }
            }).statics({
                template: "//{{domain}}/{{media_id}}:{{size}}",
                size: "smallthumb"
            });

            twttr.mediaType("JustinTV", {
                title: "JustinTV",
                domain: "justin.tv",
                icon: "//justin.tv/favicon.ico",
                username: "justintv",
                matchers: {
                    embed: /([a-zA-Z0-9_\-\?\=]*\.)?justin\.tv\/[a-zA-Z0-9]+(\/b\/\d+)?\/?(\?\w*?)?(#\w*)?$/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("http://api.justin.tv/api/embed/from_url.json", {
                        url: this.url
                    }, callback);
                }
            });

            twttr.mediaType("Photobucket", {
                title: "Photobucket",
                domain: "photobucket.com",
                icon: "http://photobucket.com/favicon.ico",
                username: "photobucket",
                matchers: {
                    user_groups: /(?:g?(?:i|s)(?:\d+|mg))\.photobucket\.com\/(?:albums|groups)\/(?:[a-zA-Z0-9_#\.\-\?\&\=\/]+)/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("http://photobucket.com/oembed", {
                        url: this.url.replace(/^([^?]*[^\/])(?=\?)/, "$1/")
                    }, callback);
                }
            });

            twttr.mediaType("Facebook", {
                title: "Facebook",
                domain: twttr.isSSL() ? "https://facebook.com" : "http://facebook.com",
                icon: twttr.isSSL() ? "https://facebook.com/favicon.ico" : "http://facebook.com/favicon.ico",
                username: "facebook",
                deciderKey: "phoenix_facebook_details",
                resolveTinyUrl: true,
                matchers: {
                    tinyUrl: /fb\.me\/([0-9a-zA-Z]+)/i,
                    app: /(fb|facebook)\.com\/([\d]+)\/?$/i,
                    profile: /(fb|facebook)\.com\/([a-zA-Z0-9\.\-]+)(\/|\?ref=.*)?$/i,
                    pages: /(fb|facebook)\.com\/pages\/[^\/]+\/([0-9]+)\/?/i,
                    events: /(fb|facebook)\.com\/events\/([0-9]+)\/?/i,
                    photo: /(fb|facebook)\.com\/photo\.php\?fbid=([a-zA-Z0-9_#\.\-\?\&\=\/]+)/i,
                    sets: /(fb|facebook)\.com\/media\/set\/\?set=[^\.]+\.([^\.]+)\..*/i,
                    other: /(fb|facebook)\.com\/([a-zA-Z0-9_#\.\-\?\&\=\/])*pid=([a-zA-Z0-9_#\.\-\?\&\=\/]+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    this.process(function () {
                        if (that.data && that.data.src) {
                            callback(that.data.src);
                        } else {
                            callback(null);
                        }
                    });
                },
                process: function (callback) {

                    var that = this,
                        data = {},
                        matchers = twttr.media.types.Facebook.matchers,
                        template = this.constructor.templates.fb,
                        params;

                    if (this.url.match(matchers.app)) {
                        data.slug = RegExp.$2;
                        data.size = this.constructor.sizes.sets;
                    }
                    if (this.url.match(matchers.profile) || this.url.match(matchers.pages) || this.url.match(matchers.events)) {

                        data.slug = RegExp.$2;

                        if (matchers.app.test(this.url)) {
                            data.size = this.constructor.sizes.small;
                        } else {
                            data.size = this.constructor.sizes.others;
                        }

                    } else if (this.url.match(matchers.photo)) {

                        params = twttr.util.paramsFromUrl(this.url);

                        if (params && params.fbid) {
                            data.slug = params.fbid;
                            data.size = this.constructor.sizes.photo;
                        }

                    } else if (this.url.match(matchers.sets)) {

                        data.slug = RegExp.$2;
                        data.size = this.constructor.sizes.small;

                    } else if (this.url.match(matchers.other)) {

                        params = twttr.util.paramsFromUrl(this.url);

                        if (params && params.id && params.l && params.pid) {
                            data.id = params.id;
                            data.l = params.l;
                            data.pid = params.pid;
                            template = this.constructor.templates.twitter;
                        }

                    }

                    if (data) {
                        this.data.src = twttr.util.supplant(template, data);
                    }

                    callback();
                }
            }).statics({
                templates: {
                    fb: "//graph.facebook.com/{{slug}}/picture?type={{size}}",
                    twitter: "//facebook.com/twitter/photo/?id={{id}}&l={{l}}&pid={{pid}}"
                },
                sizes: {
                    others: "normal",
                    small: "small",
                    photo: "thumbnail"
                }
            });

            twttr.mediaType("Apple", {
                title: "Apple",
                domain: "//itunes.apple.com",
                icon: "//itunes.apple.com/favicon.ico",
                username: "Apple",
                deciderKey: "phoenix_apple_itunes",
                matchers: {
                    tinyUrl: /itun.es\/([^\/]+)(\/[\w|\.\-]+)?/i,
                    others: /itunes\.apple\.com(?:\/[a-z][a-z])?\/(app|album|video|music\-video|podcast|imix|imixes|preorder)\/.*(id([a-zA-Z0-9]+))/i,
                    event: /itunes\.apple\.com(?:\/[a-z][a-z])?\/event\/.*(id([a-zA-Z0-9]+))(\?i=([a-zA-Z0-9]+))?/i
                },
                resolveTinyUrl: true,
                getImageURL: function (callback) {
                    var that = this;

                    this.process(function () {
                        if (that.data && that.data.src) {
                            callback(that.data.src);
                        } else {
                            callback(null);
                        }
                    });
                },
                process: function (callback) {
                    var that = this,
                        matchers = twttr.media.types.Apple.matchers,
                        id;

                    if (this.url.match(matchers.others) || this.url.match(matchers.event)) {

                        id = RegExp.lastParen;

                        phx.sandboxedAjax.send({
                            url: "//itunes.apple.com/lookup",
                            type: "GET",
                            dataType: "jsonp",
                            data: {
                                id: id
                            },
                            success: function (data) {

                                if (data && data.results.length > 0) {
                                    var result = data.results[0];

                                    if (result.trackIds && result.trackIds.length > 0) {
                                        that.url = "itunes.apple.com/imix/id" + result.trackIds[0];
                                        that.process(callback);
                                    }

                                    if (result.artworkUrl60) {
                                        that.data.src = result.artworkUrl60;
                                    } else if (result.artworkUrl100) {
                                        that.data.src = result.artworkUrl100;
                                    } else {
                                        callback();
                                    }
                                }

                                callback();
                            }
                        });
                    }
                }
            });

            twttr.mediaType("Rdio", {
                title: "Rdio",
                domain: "//rdio.com",
                icon: "//www.rdio.com/favicon.ico",
                username: "Rdio",
                matchers: {
                    rdio: /(?:rd\.io|rdio\.com)\/[a-zA-Z0-9_#\.\-\?\&\=\/]+/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("//rdio.com/api/oembed", {
                        url: this.url
                    }, callback);
                }
            });

            twttr.mediaType("SlideShare", {
                title: "SlideShare",
                domain: "//slideshare.com",
                icon: "//www.slideshare.net/favicon.ico",
                username: "SlideShare",
                deciderKey: "phoenix_instagram_and_friends",
                matchers: {
                    slides: /slideshare\.(?:com|net)\/[a-zA-Z0-9\.]+\/[a-zA-Z0-9\-]+\/?[a-zA-Z0-9_#\.\-\?\&\=\/]+?/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("//www.slideshare.net/api/oembed/2", {
                        format: "json",
                        url: this.url
                    }, callback);
                }
            });

            twttr.mediaType("BlipTV", {
                title: "BlipTV",
                domain: "//blip.tv",
                icon: "//blip.tv/favicon.ico",
                username: "bliptv",
                resolveTinyUrl: true,
                matchers: {
                    tinyUrl: /blip\.tv\/episode\/[\d]+/i,
                    videos: /blip\.tv\/(?:(?:file\/[\w\-]+)|(?:(?:[\w\-]+\/)?[\w\-]+\-(?:\d+)))\/?/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("//blip.tv/oembed", {
                        url: this.url
                    }, callback);
                }
            });

            twttr.mediaType("Imgur", {
                title: "Imgur",
                domain: "http://i.imgur.com",
                icon: "http://imgur.com/favicon.ico",
                username: "imgur",
                matchers: {
                    photo: /imgur\.com\/([^\/|\.]+\/?)+/i
                },
                getImageURL: function (callback) {
                    var that = this,
                        matcher = twttr.media.types.Imgur.matchers;

                    if (this.url.match(matcher.photo)) {

                        twttr.getImageURL(this.constructor.template, {
                            domain: this.domain,
                            slug: RegExp.lastParen
                        }, callback);

                    }

                    callback(null);
                }
            }).statics({
                template: "{{domain}}/{{slug}}b.jpg"
            });

            twttr.mediaType("Hulu", {
                title: "Hulu",
                domain: "http://www.hulu.com",
                icon: "http://www.hulu.com/favicon.ico",
                username: "hulu",
                matchers: {
                    video: /hulu\.com\/w(atch)?\/([a-zA-Z0-9]+)/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("http://www.hulu.com/api/oembed", {
                        url: this.url
                    }, callback);
                }
            });

            twttr.mediaType("NHL", {
                title: "NHL",
                domain: "http://www.nhl.com",
                icon: "http://www.nhl.com/favicon.ico",
                username: "NHL",
                matchers: {
                    video: /video\.([a-z]{4,11}\.)?nhl\.com\/videocenter\/console\?(((catid=-?\d+&)?id=\d+)|(hlg=\d{8},\d,\d{1,4}(&event=[A-Z0-9]{4,6})?)|(hlp=\d{5,10}(&event=[A-Z0-9]{4,6})?))/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("http://video.nhl.com/videocenter/oembed", {
                        url: this.url
                    }, callback);
                }
            });

            twttr.mediaType("Meetup", {
                title: "Meetup",
                domain: "http://www.meetup.com",
                icon: "http://www.meetup.com/favicon.ico",
                username: "meetup",
                matchers: {
                    anevent: /(?:(((www|dev)\.){0,2}?meetup.com)|meetu.ps)\/(?:u\/)?[\w\-]{3,}(?:[a-zA-Z0-9_#\.\-\?\&\=\/]+)/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("//api.meetup.com/oembed", {
                        url: this.url
                    }, callback);
                }
            });

            twttr.mediaType("WordPress", {
                title: "WordPress",
                domain: "//www.wordpress.com",
                icon: "//www.wordpress.com/favicon.ico",
                username: "WordPress",
                resolveTinyUrl: true,
                matchers: {
                    tinyUrl: /(?:[a-z0-9]+\.)?wp\.me[\/\?][a-zA-Z0-9_#\.\-\?\&\=\/]+$/i,
                    standardUrl: /(?:[a-z0-9]+\.)?wordpress\.com[\/\?][a-zA-Z0-9_#\.\-\?\&\=\/]+$/i
                },
                getImageURL: function (callback) {
                    phx.sandboxedAjax.oembed("//public-api.wordpress.com/oembed/1.0/?for=twitter.com&as_article=true", {
                        url: this.url
                    }, callback);
                }
            });

            twttr.mediaType("WhoSay", {
                title: "WhoSay",
                domain: "//www.whosay.com",
                icon: "//www.whosay.com/favicon.ico",
                username: "WhoSay",
                resolveTinyUrl: true,
                matchers: {
                    tinyUrl: /say\.ly\/[a-zA-Z0-9]+/i,
                    media: /whosay\.com\/[^\/\s]+\/photos\/(\d+)/i
                },
                getImageURL: function (callback) {
                    var that = this;

                    if (this.slug) {

                        twttr.getImageURL(this.constructor.template, {
                            id: this.slug,
                            size: that.constructor.size
                        }, callback);

                    }

                    callback(null);
                }
            }).statics({
                template: "//d1au12fyca1yp1.cloudfront.net/{{id}}/{{id}}_{{size}}lt.jpg",
                size: "me"
            });

            exp(phx);
        });

    });

    provide("previeweet/media", function (exp) {
        using("previeweet/media/types", "app/utils/sandboxed_ajax", "previeweet/url_resolver", function (types, sa, UrlResolver) {

            function PrevieweetMedia() {

                this.urlResolver = new UrlResolver();

                this.selectors = {
                    timeline: "#timeline",
                    tweet: ".tweet",
                    container: ".content",
                    mediaElement: "[data-expanded-url], [data-pre-embedded]"
                };

                this.template = '<div class="previeweet"><a href="//twitter.com/{{username}}" title="{{name}}"><img src="{{icon}}" alt="{{name}}"></a></div>';

                this.matchUrl = function (url) {

                    var i,
                        matcher,
                        match;

                    if (this.alreadyMatched[url]) {
                        return this.alreadyMatched[url];
                    }

                    for (i = 0; types.matchers[i]; i += 1) {
                        matcher = types.matchers[i];
                        match = url.match(matcher[0]);

                        if (match && match.length) {
                            if (matcher[2] === "tinyUrl" && types.mediaTypes[matcher[1]].resolveTinyUrl) {
                                return {
                                    isTinyUrl: true
                                };
                            }

                            this.alreadyMatched[url] = {
                                url: url,
                                slug: match[1],
                                type: types.mediaTypes[matcher[1]],
                                label: matcher[2]
                            };

                            return this.alreadyMatched[url];
                        }
                    }
                };

                this.MediaObj = function (data) {

                    var method;

                    this.data = {};
                    this.url = data.url;
                    this.slug = data.slug;
                    this._name = data.type._name;
                    this.constructor = data.type;
                    this.domain = this.constructor.domain;
                    this.icon = this.constructor.icon;
                    this.username = this.constructor.username;
                    this.template = this.constructor.template;
                    this.preEmbed = this.constructor.preEmbed || false;
                    this.getImageURL = this.constructor.getImageURL;
                    this.process = this.constructor.process;

                    for (method in this.constructor.methods) {
                        if (typeof this.constructor.methods[method] === "function") {
                            this[method] = this.constructor.methods[method];
                        }
                    }
                };

                this.resolveMedia = function (elem, callback) {
                    var that = this,
                        url,
                        media = {},
                        matchedUrlData,
                        tiny,
                        goodGuy;

                    url = elem.attr('data-resolved-tinyurl');

                    if (url) {
                        media = {
                            resolved: true,
                            url: url
                        };
                    } else {
                        media.url = elem.attr('data-expanded-url') || elem.text();
                    }

                    if (!media.url) {
                        return callback(false, elem);
                    }

                    matchedUrlData = this.matchUrl(media.url);

                    if (matchedUrlData) {
                        if (matchedUrlData.isTinyUrl) {
                            elem.on("previeweetWantsLinkResolution", function (e, data) {
                                if (data && data.url) {
                                    elem.attr('data-resolved-tinyurl', data.url);
                                    that.resolveMedia(elem, callback);
                                }
                            });

                            this.urlResolver.resolveLink(elem, media.url);

                            return;
                        }

                        // if it is processing a resolvedUrl
                        // it replaces the tinyUrl data with the resolvedUrl ones
                        if (media.resolved) {
                            tiny = elem.attr('data-expanded-url');

                            if (tiny) {
                                this.alreadyMatched[tiny] = this.alreadyMatched[media.url];
                            }
                        }

                        goodGuy = new this.MediaObj(matchedUrlData);

                        if (goodGuy.preEmbed) {
                            goodGuy.slug = elem.closest(this.selectors.tweet).attr("data-item-id");
                        }

                        if (goodGuy.getImageURL) {
                            goodGuy.getImageURL(function (url) {
                                if (url) {
                                    elem.attr("data-previeweet", url);
                                    elem.data("previeweet-service", goodGuy._name);

                                    callback(true, elem);
                                }

                                callback(false, elem);
                            });
                        }
                    }

                    callback(false, elem);
                };

                this.resolveThumbUrl = function (elem) {
                    var $elem = $(elem);
                    this.resolveMedia($elem, this.resolveThumbCallback.bind(this));
                };

                this.resolveThumbCallback = function (success, elem) {
                    if (success) {
                        this.loadThumb(elem);
                    } else {
                        this.thumbFailed(elem);
                    }
                };

                this.loadThumb = function (elem) {
                    var that = this,
                        img = $('<img/>');

                    img.on('load', function () {
                        that.thumbSucceeded(elem, img);
                    }).on('error', function () {
                        that.thumbFailed(elem);
                    }).attr('src', elem.attr("data-previeweet"));

                };

                this.thumbSucceeded = function (elem, img) {

                    var service = elem.data("previeweet-service"),
                        serviceInfo,
                        previeweet;

                    if (service) {
                        serviceInfo = types.mediaTypes[service];

                        previeweet = types.twttr.util.supplant(this.template, {
                            name: service,
                            username: serviceInfo.username,
                            icon: serviceInfo.icon
                        });

                        if (previeweet) {
                            elem
                                .closest(this.selectors.tweet)
                                .attr("data-with-previeweet", true)
                                .find(this.selectors.container)
                                .append($(previeweet).prepend(img));
                        }
                    }

                };

                this.thumbFailed = function (elem) {
                    var next = elem.nextAll(this.selectors.mediaElement);

                    if (next.length > 0) {
                        this.resolveThumbUrl(next.eq(0));
                    }
                };

                types.sandboxedAjax.send = function (settings) {
                    sa.send(types.sandboxedAjax.sandboxes.jsonp, settings);
                };

                this.alreadyMatched = {};

            }
            exp(PrevieweetMedia);
        });
    });

    provide("previeweet", function (exp) {
        using("app/boot/tweet_timeline", "previeweet/media", function (timeline, PrevieweetMedia) {
            var m = new PrevieweetMedia(),
                selectors = m.selectors,
                img,
                tweet,
                init = function () {

                    var doTheConga = function () {
                        var timeline = $(selectors.timeline),
                            tweets = timeline.find(selectors.tweet);

                        tweets.each(function () {
                            img = $(this).find(selectors.mediaElement).eq(0);
                            m.resolveThumbUrl(img);
                        });

                        timeline.on("uiHasInjectedTimelineItem", function (e) {

                            tweet = e.target;

                            if (tweet) {
                                img = $(tweet).find(selectors.mediaElement).eq(0);
                                m.resolveThumbUrl(img);
                            }
                        });
                    };

                    $(document).on("uiPageChanged", doTheConga);

                    // Come on
                    // shake your body baby
                    doTheConga();
                };

            exp({
                init: init
            });
        });
    });

    using("previeweet", function (previeweet) {
        previeweet.init();
    });

}());