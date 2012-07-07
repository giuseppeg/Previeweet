// Copyright (c) 2012 by Giuseppe Gurgone
//
// This work is licensed for reuse under the MIT license.
// See the included LICENSE file for details.
//
// https://github.com/giuseppg/Previeweet/LICENSE

(function ($, using, twttr) {

    "use strict";


    var previeweet = {
        addImage: function (tweetID, imageUrl) {
            $('[data-tweet-id="' + tweetID + '"]')
                .addClass('previeweet')
                .find('.content')
                .append(
                    $('<div/>', { 'class' : 'previeweetContainer' })
                        .append(
                            $('<img/>', {
                                'src': imageUrl,
                                'alt': 'Photo preview'
                            })
                        )
                );
        },
        getImageUrl: function (service, filename) {
            if (filename) {
                var services = {
                    'instagr.am': 'https://instagr.am/p/' + filename + '/media/?size=t',
                    'twitpic.com': 'https://twitpic.com/show/thumb/' + filename,
                    'yfrog.com': 'https://yfrog.com/' + filename + ':small',
                    'lockerz.com': 'https://api.plixi.com/api/tpapi.svc/imagefromurl?size=small&url=http%3A%2F%2Flockerz.com%2Fs%2F' + filename,
                    'i.imgur.com': 'http://i.imgur.com/' + filename.replace('.', 'b.')
                };

                if (services.hasOwnProperty(service)) {
                    return services[service];
                }

            }

            return false;

        },
        main: function (streamManager) {

            var that = this,
                tweets,
                tweetsID,
                entities,
                services = ['instagr.am',
                            'twitpic.com',
                            'yfrog.com',
                            'lockerz.com',
                            'i.imgur.com'];

            // selects all the tweets that don't have a preview yet
            tweets = $('.tweet:not(".previeweet")');

            // create an Array of the tweets ID
            tweetsID = $.map(tweets, function (elem) {
                return $(elem).attr('data-tweet-id');
            });

            // retrieve and process the tweets from the twttr global Object
            // to find the ones that have a picture hosted on pic.twitter.com
            // streamManager.streams.current.items ( tweets )
            $.each(streamManager.streams.current.items, function (index, tweet) {

                // the entities Object contains the tweet infos
                if (tweet.hasOwnProperty("entities")) {

                    entities = tweet.entities;

                    // the entities Object has the media property? we probably have images here!
                    if (typeof entities !== 'undefined' && entities.hasOwnProperty("media")) {

                        // declare here or at the top of the method? (same doubt with entities and other variables)
                        var media = entities.media,
                            imageUrl;

                        // media is an Array
                        if (media.length > 0) {

                            // let's grab the 1st image
                            media = media[0]; // media[0] is an Object

                            // checks on media:
                            // 1) is a photo?
                            // 2) does this tweet has been processed before? ( tweetsID.indexOf(tweet.id) !== -1 )
                            // 3) does the media Object contains an image URL? ( media_url_http or media_url_https )
                            if (media.hasOwnProperty("type") &&
                                    media.type === "photo" &&
                                    tweetsID.indexOf(tweet.id) !== -1 &&
                                        (media.hasOwnProperty("media_url_http") ||
                                          media.hasOwnProperty("media_url_https")
                                        )
                                    ) {

                                // try to get the https one, always!
                                imageUrl = media.hasOwnProperty("media_url_https") ? media.media_url_https + ':thumb' : media.media_url_http + ':thumb';
                                // ok let's append the preview to the DOM
                                that.addImage(tweet.id, imageUrl);
                            }
                        }
                    }
                }

            }); // end of pic.twitter.com images processing

            // other services are not mapped into the twttr global Object
            // so let's loop the services Array and see if we got other services' images
            $.each(services, function (index, service) {

                // let's get all the tweets that contain a "service" image 
                var mediaLinks = tweets.find('[data-expanded-url*="' + service + '/"]');

                // loop throught the tweets
                mediaLinks.each(function () {

                    var mediaLink = $(this),

                    // we need the parent of the image's link
                    // so we can check whether it does have a preview or not
                        tweet = mediaLink.closest('.tweet'),
                        tweetID,
                        filename,
                        imageUrl;

                    if (tweet.length > 0) {

                        // retrieve the parent's ID
                        tweetID = tweet.attr('data-tweet-id');

                        // do we have an ID?
                        // does this tweet has been processed before?
                        if (tweetID && tweetsID.indexOf(tweetID) !== -1) {

                            // NO! let's add the preview image

                            // get the filename
                            filename = mediaLink.attr('data-expanded-url').split('/').filter(function (parts) { return !!parts; }).pop();

                            if (filename) {

                                // invoke the getImageUrl to retrieve the thumbnail's URL
                                imageUrl = that.getImageUrl(service, filename);

                                // do we have an image URL?
                                if (imageUrl) {
                                    // ok let's append the preview to the DOM
                                    that.addImage(tweetID, imageUrl);
                                }

                            }

                        }
                    }
                });
            }); // end of other services images processing

        },
        init: function () {

            var that = this,
                boot,
                streamManager;

            // checks if the twitter dependencies manager (loadrunner) is there ( https://github.com/danwrong/loadrunner )
            // checks if the twttr global Object defined
            if (typeof using === 'function' && typeof twttr !== 'undefined') {

                // dependecies: twttr.bundleMore
                using(twttr.bundleMore, function () {

                    // safe boot hack (experienced some failure even when the dependency was resolved)
                    boot = setInterval(function () {

                        // twttr.app.fullyLoaded() 
                        // returns true when the app is fullyLoaded :)
                        if (twttr.app.fullyLoaded()) {

                            clearInterval(boot);

                            try {

                                // let's get the current page's streamManager instance
                                // it contain all the stuffs we need :)
                                streamManager = twttr.app.currentPage().getInstanceProperty("streamManager");

                                // let's bind these events so the main method will be executed on updates / new tweets
                                streamManager.bind('newItemsCountChanged doneLoadingMore', function () {
                                    that.main(streamManager);
                                });

                                // first execution on the current displayed tweets
                                streamManager.trigger('doneLoadingMore');

                            } catch (e) {
                                // something went wrong
                                // should be something go here?
                            }

                        }
                    }, 2000);

                });

            }
        }
    };

    // launch this baby
    previeweet.init();

})(window.jQuery, window.using, window.twttr);