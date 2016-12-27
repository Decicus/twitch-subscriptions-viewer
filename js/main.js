/**
 * Fetches from the specified URL, which expects a JSON response.
 * 
 * @param  {String}   url      The URL to fetch from
 * @param  {Function} callback Callback with two parameters: success (bool), data (object)
 * @return {Void}
 */
var fetch = function(url, callback) {
    $.ajax({
        dataType: 'jsonp',
        method: 'GET',
        url: url,
        success: function(data, status, xhr) {
            callback(true, {
                data: data,
                status: status
            });
        },
        error: function(xhr, status, error) {
            console.log(xhr);
            callback(false, {
                status: status,
                error: error
            });
        }
    });
};

/**
 * Appends subscription information to the DOM.
 * 
 * @param  {Object} sub Subscription information
 * @param  {Object} cd Channel data
 * @return {Void}
 */
var append = function(sub, cd) {
    var pro = sub.product;
    var clone = $('#template').clone();
    var channel = cd.display_name;
    var purchase = sub.purchase_profile;
    
    clone.attr('id', cd.name);
    $('.panel-heading', clone).html(
        $('<a/>')
            .attr('href', 'https://www.twitch.tv/' + cd.name)
            .html('<i class="fa fa-1x fa-twitch"></i> ' + channel)
    );
    $('.panel-body .media-left img', clone).attr('src', cd.logo);
    $('.panel-body .media-body .media-heading', clone).html(pro.name);
    
    var emotes = pro.emoticons;
    
    if (emotes.length > 0) {
        var element = $('.panel-body .emotes', clone);
        for (var i = 0; i < emotes.length; i++) {
            var emote = emotes[i];
            if (emote.state === "active") {
                element.append(
                    $('<img/>')
                        .attr('src', emote.url)
                        .attr('title', emote.regex)
                );
            }
        }
        
        element.css('display', 'block');
    }

    var expires = $('.expires', clone);
    if (purchase.will_renew) {
        var d = new Date(sub.access_end);
        d.setUTCDate(d.getUTCDate() - 3);
        var date = d.toUTCString().split(" ");
        date.shift(); // Removes name of day
        date.pop(); // Removes timezone
        $('p', expires).html(date.join(" ") + " (UTC)");
    } else {
        if (sub.access_end !== null) {
            var end = Date.parse(sub.access_end);
            $('h4', expires).html('Expires:');
            $('p', expires).html(end.toLocaleString());
        }
    }
    
    $('.consecutive .months', clone).html(purchase.consecutive_months);
    
    clone.appendTo('.subscriptions .content');
};

$(document).ready(function() {
    var apiUrl = 'https://api.twitch.tv/api/users/{name}/tickets?oauth_token={token}&limit=100&offset=0',
        container = $('.subscriptions'),
        content = $('.content', container),
        connect = $('.connect'),
        error = $('.error'),
        ticketCache = {};
    
    Twitch.init({clientId: client_id}, function(err, stat) {
        if (stat.authenticated) {
            var token = Twitch.getToken();
            connect.hide();
            
            Twitch.api({method: ''}, function(err, data) {
                if (!err) {
                    var username = data.token.user_name;
                    var url = apiUrl.replace('{name}', username).replace('{token}', token);
                    
                    fetch(url, function(success, data) {
                        if (success) {
                            container.show();
                            var tickets = data.data.tickets;
                            var length = tickets.length;
                            
                            if (length > 0) {
                                for (var i = 0; i < length; i++) {
                                    var sub = tickets[i];
                                    var pro = sub.product;
                                    var channel = pro.partner_login;
                                    
                                    // Channel subscription
                                    if (channel !== null) {
                                        // The ticket cache is mainly just a ghettofix, because the loop finishes before all the requests do.
                                        // This becomes really fucky, since if I attempt to reference local variables
                                        // it will just go to the latest subscription and reference that instead of the one I was hoping to reference
                                        // Thus I reference the ticketCache based on the username. This should cover 99.9% of the cases
                                        // but of course Twitch API can be inconsistent and not give the right username, which is hilarious
                                        ticketCache[channel] = sub;
                                        Twitch.api({method: '/channels/' + sub.product.partner_login}, function(err, cd) {
                                            if (!err) {
                                                append(ticketCache[cd.name], cd);
                                            }
                                        });
                                    } else {
                                        // Turbo/other
                                        // Lets just force some values for "channel data" instead
                                        if (pro.short_name === "turbo") {
                                            append(sub, {
                                                display_name: pro.name,
                                                logo: './img/Glitch.png',
                                                url: 'https://www.twitch.tv/turbo'
                                            });
                                        } else if (pro.short_name === "twitch_prime") {
                                            append(sub, {
                                                display_name: pro.name,
                                                logo: 'https://static-cdn.jtvnw.net/badges/v1/a1dd5073-19c3-4911-8cb4-c464a7bc1510/3',
                                                url: 'https://twitch.amazon.com/prime'
                                            });
                                        } else {
                                            // ¯\_(ツ)_/¯
                                        }
                                    }
                                }
                            } else {
                                content.append('<p class="text-info">You do not have any subscriptions.</p>');
                            }
                        } else {
                            error.html(error);
                            error.show();
                        }
                    });
                } else {
                    error.html(error);
                    error.show();
                }
            });
        }
    });

    $('.connect').on('click', function() {
        Twitch.login({
            scope: ['user_subscriptions'],
            force_verify: true
        });
    });

    $('.logout').on('click', function() {
        Twitch.logout();
        connect.show();
        container.hide();
    });
});
