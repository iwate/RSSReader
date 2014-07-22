/// <reference path="typings/jquery/jquery.d.ts" />
/// <reference path="typings/google.feeds/google.feed.api.d.ts" />
/// <reference path="typings/jquery.storageapi/jquery.storageapi.d.ts" />

var info = {
    projectName: "my_rss_name"
    , version: "1.0.0"
};

var storage = $.initNamespaceStorage(info.projectName).localStorage;

module Entities {
    export class Site {
        public entries: feedEntry[];
        constructor(
            public url: string,
            public title?: string,
            public max: number = 20) {
        }
    }
    export interface Entry extends feedEntry { }
}
module Models {
    export class SiteLoader {
        private feed: google.feeds.Feed;
        private site: Entities.Site;
    constructor(site: Entities.Site)
    constructor(url: string, max?: number)
    constructor(arg1: any, arg2?: number) {
            var url: string, max: number;
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
        load(): JQueryPromise<Entities.Site> {
            var deferred = $.Deferred<Entities.Site>();
            this.feed.load((result) => {
                if (!result.error) {
                    this.site.title = result.feed.title;
                    this.site.entries = result.feed.entries;
                    deferred.resolve(this.site);
                } else {
                    deferred.reject(result.error);
                }
            });
            return deferred.promise();
        }
    }
    export class SiteCollection{
        static Tag: string = "sites";
        private sites: Entities.Site[];
        constructor(private storage: JQueryStorage) {
            this.sites = this.toArray();
        }
        static createNewSite(url: string, max: number = 20): JQueryPromise<Entities.Site> {
            return new SiteLoader(url, max).load();
        }
        add(site: Entities.Site): boolean {
            var isContain = this.sites.reduce((prev, current) => {
                return prev || current.url === site.url;
            }, false);
            if (!isContain) {
                this.sites.push(site);
                this.storage.set(SiteCollection.Tag, site.url, site);
                return true;
            }
            return false;
        }
        remove(site: Entities.Site) {
            this.sites.splice(this.indexOf(site), 1);
            this.storage.remove(SiteCollection.Tag, site.url);
        }
        at(index: number): Entities.Site {
            return this.sites[index];
        }
        indexOf(site: Entities.Site): number {
            return this.sites.indexOf(site);
        }
        toArray(): Entities.Site[] {
            if (this.sites) {
                return this.sites;
            } else {
                var dict = this.toDictionary();
                var sites: Entities.Site[] = [];
                for (var key in dict) {
                    sites.push(dict[key]);
                }
                return sites;
            }
        }
        toDictionary(): any {
            return this.storage.get(SiteCollection.Tag) || {};
        }
    }
    export class EntryManager{
        private siteLoaders: any = {};
        private postUpdateListeners: Array<(entries: Entities.Entry[]) => void> = [];
        private failUpdateListeners: Array<(message: string) => void> = [];
        private entries: Entities.Entry[];
        private defaultComparator = function (a: Entities.Entry, b: Entities.Entry) {
            return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
        }
        load(sites: Entities.Site[],comparator?: (a: Entities.Entry, b: Entities.Entry) => number) {
            var loadPromises: JQueryPromise<Entities.Site>[] = [];
            var entries: Entities.Entry[] = [];
            sites.forEach((site) => {
                if (!this.siteLoaders[site.url]) {
                    this.siteLoaders[site.url] = new Models.SiteLoader(site);
                }
                loadPromises.push(
                    this.siteLoaders[site.url]
                        .load()
                        .then((site: Entities.Site) => {
                            entries = entries.concat(site.entries);
                        })
                    );
            });
            $.when.apply($, loadPromises)
                .fail(() => {
                    this.notifyFailUpdate("error in load");
                })
                .always(() => {
                    this.entries = entries;
                    this.sort(comparator || this.defaultComparator);
                    this.notifyPostUpdate();
                })
    }
        sort(comparator: (a: Entities.Entry, b: Entities.Entry)=>number) {
            this.entries.sort(comparator);
            this.notifyPostUpdate();
        }
        private notifyPostUpdate() {
            this.postUpdateListeners.forEach((listener) => {
                listener(this.entries);
            });
        }
        private notifyFailUpdate(message:string) {
            this.failUpdateListeners.forEach((listener) => {
                listener(message);
            });
        }
        addPostUpdateListener(listener: (entries: Entities.Entry[]) => void) {
            this.postUpdateListeners.push(listener);
        }
        addFailUpdateListener(listener: (message:string) => void) {
            this.failUpdateListeners.push(listener);
        }
    }
}
module Views {
    export interface ITemplate {
        render(): JQuery;
    }
    export class SiteListItemView implements ITemplate {
        private html = "<li>{{title}}</li>";
        private $element: JQuery;
        constructor(private site: Entities.Site, onClick: () => void) {
            this.$element = $(this.html.replace("{{title}}", this.site.title));
            this.$element.click(onClick);
    }
        render(): JQuery {
            return this.$element;
        }
    }
    export class SiteListView implements ITemplate {
        private html = '<ul id="rss-list"><li id = "rss-all"class = "active" > All </li ></ul>';
        private $element: JQuery;
        constructor(onClickAll: () => void) {
            this.$element = $(this.html);
            this.$element.find("#rss-all").click(onClickAll);
            this.$element.find("#rss-all").click((ev) => {
                this.unactive();
                $(ev.target).addClass("active");
            });
        }
        render(): JQuery {
            return this.$element;
        }
        append(item: Views.SiteListItemView) {
            var $item = item.render();
            $item.click((ev) => {
                this.unactive();
                $(ev.target).addClass("active");
            })
            $item.appendTo(this.$element);
        }
        private unactive() {
            this.$element.find(".active").removeClass("active");
        }
    }
    export class EntryListItemView implements ITemplate {
        private html = '<article><h3>‎{{pubDate}}</h3><h2><a href = "{{link}}" >{{title}}</a></h2 ><div class="content" >{{content}}</div></article>';
        private $element: JQuery;
        constructor(private entry: Entities.Entry) {
            this.$element = $(this.html
                .replace("{{pubDate}}", entry.publishedDate)
                .replace("{{link}}", entry.link)
                .replace("{{title}}", entry.title)
                .replace("{{content}}", entry.content));
            this.$element.find("a").click((ev) => {
                ev.preventDefault();
                window.open($(ev.target).attr("href"));
            });
        }
        render(): JQuery {
            return this.$element;
        }
    }
    export class EntryListView implements ITemplate {
        private html = "<section></section>";
        private $element: JQuery;
        constructor(manager: Models.EntryManager) {
            this.$element = $(this.html);
            manager.addPostUpdateListener((entries: Entities.Entry[]) => {
                this.removeAll();
                entries.forEach((entry) => {
                    this.append(entry);
                })
        });
        }
        render(): JQuery {
            return this.$element;
        }
        removeAll() {
            this.$element.html("");
        }
        append(entry: feedEntry) {
            this.$element.append(new EntryListItemView(entry).render());
        }
    }
}

window.onload = function () {
    var siteCollection = new Models.SiteCollection(storage);
    var entityManager = new Models.EntryManager();
    var siteList = new Views.SiteListView(() => {
        entityManager.load(siteCollection.toArray());
    });
    var entryList = new Views.EntryListView(entityManager);

    siteCollection.toArray().forEach((site) => {
        siteList.append(new Views.SiteListItemView(site, () => {
            entityManager.load([site]);
        }));
    });

    $("nav").append(siteList.render());
    $("#main-container").append(entryList.render());
    $("#register-rss  button").click(function () {
        var rssUrl = $("#register-rss  input").val();
        Models.SiteCollection
            .createNewSite(rssUrl)
            .done((site: Entities.Site) => {
                if (siteCollection.add(site)) {
                    siteList.append(new Views.SiteListItemView(site, () => {
                        entityManager.load([site]);
                    }));
                }
            }).fail((error: any) => {
                alert(error.message);
            });
    });

    entityManager.load(siteCollection.toArray());
}