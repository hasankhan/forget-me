var async = require('async'),
    _ = require('underscore'),
    config = require('mobileservice-config'),
    log = console.log;
    
function purge() {
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    purgeTwitter(tables.getTable('twitter'),
                 config.appSettings.TwitterScreenName, 
                 config.twitterConsumerKey, 
                 config.twitterConsumerSecret,
                 config.appSettings.TwitterToken,
                 config.appSettings.TwitterTokenSecret,
                 yesterday);
                 
    purgeTumblr(tables.getTable('tumblr'),
                config.appSettings.TumblrBlog, 
                config.appSettings.TumblrConsumerKey, 
                config.appSettings.TumblrConsumerSecret, 
                config.appSettings.TumblrToken, 
                config.appSettings.TumblrTokenSecret,
                yesterday);                    
}

function purgeTwitter(table, screenName, consumerKey, consumerSecret, token, tokenSecret, olderThan) {    
    var Twit = require('twit');
    
    var T = new Twit({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        access_token: token,
        access_token_secret: tokenSecret
    })
    
    T.get('statuses/user_timeline', { screen_name: screenName },  function (err, data, response) {
          if (err) return log(err);
          async.each(data, function(tweet, done) { 
              var createdAt = new Date(tweet.created_at);
              if (createdAt > olderThan) {             
                log('skipping new tweet', tweet.text);
                return done();
              }
              
              deleteTweet(table, T, tweet, done);
          }, function (err) {
              if (err) return log(err);
              
              log('successfully processed tweets', data);
          });
    });
}

function deleteTweet(table, T, tweet, done) {
    log('deleting tweet', tweet);
    table.insert(fixup(tweet), {
        success: function() {
            setTimeout(function(){                
                T.post('statuses/destroy/:id', { id: tweet.id_str }, done);
            }, 5000);
        },
        error: done
    });    
}

function purgeTumblr(table, blog, consumerKey, consumerSecret, token, tokenSecret, olderThan) {    
    var tumblr = require('tumblr.js');
    
    var client = tumblr.createClient({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      token: token,
      token_secret: tokenSecret
    });    
    var url = blog + '.tumblr.com';
    
    client.posts(url, function (err, data) {
        if (err) return log('error fetching posts', err);
        
        async.each(data.posts, function(post, done) {
            var createdAt = new Date(post.date);
            if (createdAt > olderThan) {             
                log('skipping new post', post.slug);
                return done();
            }
            
            deleteTumblr(table, client, url, post, done);
        }, function (err) {
            if (err) return log('error deleting posts', err);
            
            log('successfully processed posts', data.posts);
        });            
    });
}

function deleteTumblr(table, client, url, post, done) {
    log('deleting ', post);
    table.insert(fixup(post), {
        success: function() {
            setTimeout(function(){                
                client.deletePost(url, post.id, done);
            }, 5000);
        },
        error: done
    });        
}

function fixup(object){
    object = _.clone(object);
    
    if (typeof object.id !== 'undefined') {
        object.id = object.id.toString()
    }
    
    for (var key in object) {
        var value = object[key];
        if (typeof value === 'object') {
            object[key] = JSON.stringify(value);
        }
    }
    return object;
}