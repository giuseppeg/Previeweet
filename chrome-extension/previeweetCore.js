(function(a){var b={main:function(b){var c=this;var d=a('.tweet:not(".previeweet")');var e=d.map(function(b,c){return a(c).attr("data-tweet-id")}).get();var f=b.streams.current.items;f=a.map(f,function(a,b){var c=a.entities;if(c){var d=c.media;if(!!d&&d.length&&d[0].type=="photo"&&e.indexOf(a.id)!=-1)return{id:a.id,url:d[0].media_url_https+":thumb"}}});var g=d.find('a[data-expanded-url*="instagr.am/p/"], a[data-expanded-url*="twitpic.com/"], a[data-expanded-url*="yfrog.com/"], a[data-expanded-url*="lockerz.com/"], a[data-expanded-url*="i.imgur.com"], a[data-ultimate-url*="dribbble.com/shots/"]');g=a.map(g,function(b,d){b=a(b);var f=b.closest(".tweet").attr("data-tweet-id");if(e.indexOf(f)!=-1){var g=b.attr("data-expanded-url");var h=g.replace("http://","").split("/").filter(function(a){return!!a});var i;var j=h.pop();if(typeof j!=="undefined")switch(h.shift()){case"instagr.am":i="https://instagr.am/p/"+j+"/media/?size=t";break;case"twitpic.com":i="https://twitpic.com/show/thumb/"+j;break;case"yfrog.com":i="https://yfrog.com/"+j+":small";break;case"lockerz.com":i="https://api.plixi.com/api/tpapi.svc/imagefromurl?size=small&url=http%3A%2F%2Flockerz.com%2Fs%2F"+j;break;case"i.imgur.com":i="http://i.imgur.com/"+j.replace(".","b.");break;case"drbl.in":c.drbl(f,b);break;default:i=false;break}if(i)return{id:f,url:i}}});f=f.concat(g);a.each(f,function(b,c){a('[data-tweet-id="'+c.id+'"]').addClass("previeweet").find(".content").append('<div class="previeweetContainer"><img src="'+c.url+'" alt="Photo preview"></div>')})},drbl:function(b,c){var d=c.attr("data-ultimate-url");var e=d.replace("http://","").split("/").filter(function(a){return!!a});if(e.indexOf("shots")!=-1){shot_id=e.pop().split("-",1);a.getJSON("http://api.dribbble.com/shots/"+shot_id+"?callback=?",function(c){a('[data-tweet-id="'+b+'"]').addClass("previeweet previeweetDrbl").find(".content").append('<a class="previeweetContainer" href="'+c.url+'" target="blank"><img src="'+c.image_teaser_url+'" alt="Photo preview"></a>')})}},safeBoot:function(){var a=this;var b=setInterval(function(){if(twttr.app.fullyLoaded()){clearInterval(b);a.init()}},2e3)},init:function(){var a=this;var b=twttr.app.currentPage().getInstanceProperty("streamManager");b.bind("newItemsCountChanged doneLoadingMore",function(){a.main(b)});b.trigger("newItemsCountChanged")}};if(typeof window.using==="function")using(twttr.bundleMore,function(){b.safeBoot()})})(jQuery)
