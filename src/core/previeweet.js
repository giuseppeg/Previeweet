(function($){

    var previeweet = {

      main : function(streamManager) {

          var tweets = $('.tweet:not(".previeweet")');
          var tweetsIDs = tweets.map(function(i, el){ return $(el).attr('data-tweet-id') }).get();

          var items = streamManager.streams.current.items;

          items = $.map(items, function(e, i){
            var entities = e.entities;
            if (entities) {
              var m = entities.media;
              if (!!m && m.length && m[0].type == 'photo' && tweetsIDs.indexOf(e.id) != -1)
                return { 'id' : e.id, 'url' : m[0].media_url_https+':thumb' };
            }
          });

          var others = tweets.find('a[data-expanded-url*="instagr.am/p/"], a[data-expanded-url*="twitpic.com/"], a[data-expanded-url*="yfrog.com/"], a[data-expanded-url*="lockerz.com/"], a[data-expanded-url*="i.imgur.com"]');

          others = $.map(others, function(e, i){

            var id = $(e).closest('.tweet').attr('data-tweet-id');

            if (tweetsIDs.indexOf(id) != -1) {

              var expanded_url = $(e).attr('data-expanded-url');
              var expanded_url_parts = expanded_url.replace('http://','').split('/').filter(function(pts){return !!pts });
              var url;
              var fname = expanded_url_parts.pop();

              if (typeof fname !== 'undefined')
                switch(expanded_url_parts.shift()){
                  case 'instagr.am':
                    url = 'https://instagr.am/p/'+fname+'/media/?size=t';
                  break;
                  case 'twitpic.com':
                    url = 'https://twitpic.com/show/thumb/'+fname;
                  break;
                  case 'yfrog.com':
                    url = 'https://yfrog.com/'+fname+':small';
                  break;
                  case 'lockerz.com':
                    url = 'https://api.plixi.com/api/tpapi.svc/imagefromurl?size=small&url=http%3A%2F%2Flockerz.com%2Fs%2F'+fname;
                  break;
                  case 'i.imgur.com':
                    url = 'http://i.imgur.com/'+fname.replace('.','b.');
                  break;
                  default:
                    url = false;
                  break;
                }
              if (url)
                return { 'id' : id, 'url' : url };
            }

          });

          items = items.concat(others);

          $.each(items, function(i, e){
            $('[data-tweet-id="'+e.id+'"]').addClass('previeweet').find('.content').append('<div class="previeweetContainer"><img src="'+e.url+'" alt="Photo preview"></div>');
          })

      },
      safeBoot : function() {
        var self = this;
        var boot = setInterval(function(){
          if (twttr.app.fullyLoaded()) {
            clearInterval(boot);
            self.init();
          }
        },1000);
      },
      init : function() {
        var self = this;

          var streamManager = twttr.app.currentPage().getInstanceProperty("streamManager");

          streamManager.bind('newItemsCountChanged doneLoadingMore', function() { self.main(streamManager) });
          streamManager.trigger('newItemsCountChanged');

      }

    }

  if (typeof window.using === 'function')
    using(twttr.bundleMore, function() {
      previeweet.safeBoot();
    });

})(jQuery);
