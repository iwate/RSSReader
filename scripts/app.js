/// <reference path="typings/jquery/jquery.d.ts" />
/// <reference path="typings/google.feeds/google.feed.api.d.ts" />
/// <reference path="typings/jquery.storageapi/jquery.storageapi.d.ts" />
var info = {
    projectName: "my_rss_name",
    version: "1.0.0"
};

var storage = $.initNamespaceStorage(info.projectName).localStorage;

var Entities;
(function (Entities) {
    var Site = (function () {
        function Site(url, title, max) {
            if (typeof max === "undefined") { max = 20; }
            this.url = url;
            this.title = title;
            this.max = max;
        }
        return Site;
    })();
    Entities.Site = Site;
})(Entities || (Entities = {}));
var Models;
(function (Models) {
    var SiteLoader = (function () {
        function SiteLoader(arg1, arg2) {
            var url, max;
            if (typeof arg1 === "string") {
                url = arg1;
                max = arg2;
                this.site = new Entities.Site(url);
            } else {
                this.site = arg1;
                url = this.site.url;
                max = this.site.max;
            }
            this.feed = new google.feeds.Feed(url);
            this.feed.setNumEntries(max);
            this.feed.setResultFormat(google.feeds.Feed.JSON_FORMAT);
        }
        SiteLoader.prototype.load = function () {
            var _this = this;
            var deferred = $.Deferred();
            this.feed.load(function (result) {
                if (!result.error) {
                    _this.site.title = result.feed.title;
                    _this.site.entries = result.feed.entries;
                    deferred.resolve(_this.site);
                } else {
                    deferred.reject(result.error);
                }
            });
            return deferred.promise();
        };
        return SiteLoader;
    })();
    Models.SiteLoader = SiteLoader;
    var SiteCollection = (function () {
        function SiteCollection(storage) {
            this.storage = storage;
            this.sites = this.toArray();
        }
        SiteCollection.createNewSite = function (url, max) {
            if (typeof max === "undefined") { max = 20; }
            return new SiteLoader(url, max).load();
        };
        SiteCollection.prototype.add = function (site) {
            var isContain = this.sites.reduce(function (prev, current) {
                return prev || current.url === site.url;
            }, false);
            if (!isContain) {
                this.sites.push(site);
                this.storage.set(SiteCollection.Tag, site.url, site);
                return true;
            }
            return false;
        };
        SiteCollection.prototype.remove = function (site) {
            this.sites.splice(this.indexOf(site), 1);
            this.storage.remove(SiteCollection.Tag, site.url);
        };
        SiteCollection.prototype.at = function (index) {
            return this.sites[index];
        };
        SiteCollection.prototype.indexOf = function (site) {
            return this.sites.indexOf(site);
        };
        SiteCollection.prototype.toArray = function () {
            if (this.sites) {
                return this.sites;
            } else {
                var dict = this.toDictionary();
                var sites = [];
                for (var key in dict) {
                    sites.push(dict[key]);
                }
                return sites;
            }
        };
        SiteCollection.prototype.toDictionary = function () {
            return this.storage.get(SiteCollection.Tag) || {};
        };
        SiteCollection.Tag = "sites";
        return SiteCollection;
    })();
    Models.SiteCollection = SiteCollection;
    var EntryManager = (function () {
        function EntryManager() {
            this.siteLoaders = {};
            this.postUpdateListeners = [];
            this.failUpdateListeners = [];
            this.defaultComparator = function (a, b) {
                return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
            };
        }
        EntryManager.prototype.load = function (sites, comparator) {
            var _this = this;
            var loadPromises = [];
            var entries = [];
            sites.forEach(function (site) {
                if (!_this.siteLoaders[site.url]) {
                    _this.siteLoaders[site.url] = new Models.SiteLoader(site);
                }
                loadPromises.push(_this.siteLoaders[site.url].load().then(function (site) {
                    entries = entries.concat(site.entries);
                }));
            });
            $.when.apply($, loadPromises).fail(function () {
                _this.notifyFailUpdate("error in load");
            }).always(function () {
                _this.entries = entries;
                _this.sort(comparator || _this.defaultComparator);
                _this.notifyPostUpdate();
            });
        };
        EntryManager.prototype.sort = function (comparator) {
            this.entries.sort(comparator);
            this.notifyPostUpdate();
        };
        EntryManager.prototype.notifyPostUpdate = function () {
            var _this = this;
            this.postUpdateListeners.forEach(function (listener) {
                listener(_this.entries);
            });
        };
        EntryManager.prototype.notifyFailUpdate = function (message) {
            this.failUpdateListeners.forEach(function (listener) {
                listener(message);
            });
        };
        EntryManager.prototype.addPostUpdateListener = function (listener) {
            this.postUpdateListeners.push(listener);
        };
        EntryManager.prototype.addFailUpdateListener = function (listener) {
            this.failUpdateListeners.push(listener);
        };
        return EntryManager;
    })();
    Models.EntryManager = EntryManager;
})(Models || (Models = {}));
var Views;
(function (Views) {
    var SiteListItemView = (function () {
        function SiteListItemView(site, onClick) {
            this.site = site;
            this.html = "<li>{{title}}</li>";
            this.$element = $(this.html.replace("{{title}}", this.site.title));
            this.$element.click(onClick);
        }
        SiteListItemView.prototype.render = function () {
            return this.$element;
        };
        return SiteListItemView;
    })();
    Views.SiteListItemView = SiteListItemView;
    var SiteListView = (function () {
        function SiteListView(onClickAll) {
            var _this = this;
            this.html = '<ul id="rss-list"><li id = "rss-all"class = "active" > All </li ></ul>';
            this.$element = $(this.html);
            this.$element.find("#rss-all").click(onClickAll);
            this.$element.find("#rss-all").click(function (ev) {
                _this.unactive();
                $(ev.target).addClass("active");
            });
        }
        SiteListView.prototype.render = function () {
            return this.$element;
        };
        SiteListView.prototype.append = function (item) {
            var _this = this;
            var $item = item.render();
            $item.click(function (ev) {
                _this.unactive();
                $(ev.target).addClass("active");
            });
            $item.appendTo(this.$element);
        };
        SiteListView.prototype.unactive = function () {
            this.$element.find(".active").removeClass("active");
        };
        return SiteListView;
    })();
    Views.SiteListView = SiteListView;
    var EntryListItemView = (function () {
        function EntryListItemView(entry) {
            this.entry = entry;
            this.html = '<article><h3>‎{{pubDate}}</h3><h2><a href = "{{link}}" >{{title}}</a></h2 ><div class="content" >{{content}}</div></article>';
            this.$element = $(this.html.replace("{{pubDate}}", entry.publishedDate).replace("{{link}}", entry.link).replace("{{title}}", entry.title).replace("{{content}}", entry.content));
            this.$element.find("a").click(function (ev) {
                ev.preventDefault();
                window.open($(ev.target).attr("href"));
            });
        }
        EntryListItemView.prototype.render = function () {
            return this.$element;
        };
        return EntryListItemView;
    })();
    Views.EntryListItemView = EntryListItemView;
    var EntryListView = (function () {
        function EntryListView(manager) {
            var _this = this;
            this.html = "<section></section>";
            this.$element = $(this.html);
            manager.addPostUpdateListener(function (entries) {
                _this.removeAll();
                entries.forEach(function (entry) {
                    _this.append(entry);
                });
            });
        }
        EntryListView.prototype.render = function () {
            return this.$element;
        };
        EntryListView.prototype.removeAll = function () {
            this.$element.html("");
        };
        EntryListView.prototype.append = function (entry) {
            this.$element.append(new EntryListItemView(entry).render());
        };
        return EntryListView;
    })();
    Views.EntryListView = EntryListView;
})(Views || (Views = {}));

window.onload = function () {
    var siteCollection = new Models.SiteCollection(storage);
    var entityManager = new Models.EntryManager();
    var siteList = new Views.SiteListView(function () {
        entityManager.load(siteCollection.toArray());
    });
    var entryList = new Views.EntryListView(entityManager);

    siteCollection.toArray().forEach(function (site) {
        siteList.append(new Views.SiteListItemView(site, function () {
            entityManager.load([site]);
        }));
    });

    $("nav").append(siteList.render());
    $("#main-container").append(entryList.render());
    $("#register-rss  button").click(function () {
        var rssUrl = $("#register-rss  input").val();
        Models.SiteCollection.createNewSite(rssUrl).done(function (site) {
            if (siteCollection.add(site)) {
                siteList.append(new Views.SiteListItemView(site, function () {
                    entityManager.load([site]);
                }));
            }
        }).fail(function (error) {
            alert(error.message);
        });
    });

    entityManager.load(siteCollection.toArray());
};
