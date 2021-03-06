function Channel( init_obj, element_id ){
	this.center = 1; 
	this.open = false;
	this.element_id = element_id;
	this.init(init_obj, element_id);
    this.selected = false;
}


Channel.prototype.getNowNext = function(callback) {
    var self = this;
    if(self.contentGuideURI) {
         $.get( self.contentGuideURI+"?sid="+self.getServiceRef()+"&now_next=true", function( data ) {
            var now_next = {};
            var boxes = [];
            var newPrograms = self.parseSchedule(data);
            if(newPrograms.length > 0) {
                 now_next["now"] = newPrograms[0];
            }
            if(newPrograms.length > 1) {
                 now_next["next"] = newPrograms[1];
            }
            self.now_next = now_next;
            if(typeof(callback) == "function"){
                callback.call();
            }

       },"text");
    }
}


Channel.prototype.getSchedule = function(callback) {
    var self = this;
    self.programs = [];

    if(self.contentGuideURI) {
         $.get( self.contentGuideURI+"?sids[]="+self.getServiceRef()+"&start="+self.epg.start+"&end="+self.epg.end, function( data ) {
                self.programs = self.parseSchedule(data);
                if(typeof(callback) == "function"){
                    callback.call();
                }
         },"text");
    }
}

Channel.prototype.init = function( init_obj, channel_index){
		var self = this;
		$.each( init_obj, function( f, field ){
			self[f] = field;
		});
        self.getNowNext();
		self.element = document.getElementById("channel_"+channel_index);
		if(self.element == null){			
            var newTextbox = document.createElement('a');
            newTextbox.href="javascript:channelSelected('"+self.id+"')";
            newTextbox.classList.add("d-flex");
            var span = document.createElement('span');
            span.classList.add("chicon","pl-1","order-3");
            var img = document.createElement('img');
            img.setAttribute("src",self.image || "./images/empty.png");
            span.appendChild(img);
            newTextbox.appendChild(span);
            var span = document.createElement('span');
            span.classList.add("chnumber","px-1");
            span.appendChild(document.createTextNode( self.lcn));
            newTextbox.appendChild(span);
            span = document.createElement('span');
            span.classList.add("chname","text-truncate");
            span.appendChild(document.createTextNode( self.title));
            newTextbox.appendChild(span);
            var li = document.createElement('li');
            li.classList.add("list-group-item");
            li.id = "channel_"+channel_index;
            var container = document.createElement("div");
            container.classList.add("d-flex","justify-content-end");
            container.appendChild(newTextbox);
            li.appendChild(container);
			self.element = li;
		}
    
}

Channel.prototype.unselected = function () {
    var self = this;
    self.selected = false;
    self.element.classList.remove("active");
}

Channel.prototype.startApp = function(aitUrl) {
    $.get( aitUrl, function( data ) {
        var apps = parseXmlAit(data);
        var app = null;
        for(var i = 0; i < apps.length;i++) {
            if(apps[i].transportType == "mhp:HTTPTransportType") {
                if(app == null || app.priority < apps[i].priority) {
                    app = apps[i];
                }
            }
        }
        if(app != null) {
          window.location = app.urlbase+app.location;
        }
     },"text");
}

Channel.prototype.channelSelected = function () {
    var self = this;
    self.element.classList.add("active");
    self.selected = true;
    var update =function () {
        var serviceInstance = self.getServiceInstance();
        self.setProgramChangedTimer();
        self.updateChannelInfo();
        if(self.mediaPresentationApp) {
            self.startApp(self.mediaPresentationApp);
        }
        else if(self.isProgramAllowed()) {
            player.attachSource(serviceInstance.dashUrl);
        }
        else {
            player.attachSource(null);
            $("#notification").show();
            $("#notification").text(i18n.getString("parental_block"));
        }
    };
    if(self.nowNextUpdateRequired()) {
        self.getNowNext(update);
    }
    else {
         update.call();
    }

}

Channel.prototype.programChanged = function() {
    var self = this;
    var update =function () {
        self.updateChannelInfo();
        var serviceInstance = self.getServiceInstance();
        if(self.isProgramAllowed()) {
            $("#notification").hide();
            try {
                if(player.getSource() != serviceInstance.dashUrl) {
                    player.attachSource(serviceInstance.dashUrl);
                }
            } catch(e) {
                //player throws an error is there is no souce attached
               player.attachSource(serviceInstance.dashUrl);
            }
        }
        else {
            player.attachSource(null);
            $("#notification").show();
            $("#notification").text(i18n.getString("parental_block"));
        }
        self.setProgramChangedTimer();
    };
    self.getNowNext(update);
}

Channel.prototype.setProgramChangedTimer = function() {
    var self = this;
    if(programChangeTimer) {
         clearTimeout(programChangeTimer);
    }
    if(self.now_next) {
        curTime = new Date();
        var now = self.now_next["now"];
        if(now) {
            if(curTime < now.end) {
                programChangeTimer = setTimeout(self.programChanged.bind(self), now.end -curTime);
            }
        }
    }
}

Channel.prototype.nowNextUpdateRequired = function() {
    var self = this;
    if(self.now_next) {
        curTime = new Date();
        var now = self.now_next["now"];
        if(now) {
            if(curTime < now.end) {
                return false;
            }
        }
    }
    return true;
}

Channel.prototype.updateChannelInfo = function () {
     var self = this;
     var channelInfo = document.getElementById("channel_info");
     var info = "";
     info = "<span class=\"menuitem_chicon d-block\"><img src=\""+(self.image || "./images/empty.png") +"\"></span>";
     info += "<span class=\"menuitem_chnumber d-inline-block\">" + self.lcn +".</span><span class=\"menuitem_chname d-inline-block\">" + self.title +"</span>";
     if(self.now_next) {
        curTime = new Date();
        var now = self.now_next["now"];
        if(now) {
            var parental = "";
            if(now.parentalRating && now.parentalRating.length > 0) {
                for(var i = 0;i < now.parentalRating.length;i++) {
                    if(now.parentalRating[i].minimumage) {
                        parental = "("+now.parentalRating[i].minimumage+")";
                        break;
                    }
                }
            }
            info += "<span class=\"menuitem_now\">Now: "+now.title+parental+" ";
            info +=  Math.max(0, Math.round((now.end.getTime() - curTime.getTime()) / 1000 / 60)) + " mins remaining</span>";
        }
        var next= self.now_next["next"];
        if(next) {
            if(next.parentalRating && next.parentalRating.length > 0) {
                for(var i = 0;i < next.parentalRating.length;i++) {
                    if(next.parentalRating[i].minimumage) {
                        parental = "("+next.parentalRating[i].minimumage+")";
                        break;
                    }
                }
            }
            info += "<span class=\"menuitem_next\">Next: "+next.title+parental+" ";
            info +=  next.start.create24HourTimeString()+" ";
            info += "Duration " + Math.max(0, Math.round((next.end.getTime() - next.start.getTime()) / 1000 / 60)) + " mins</span>";
        }
     }
     channelInfo.innerHTML = info;
}



Channel.prototype.showEPG = function () {
    var self = this;
    var programList = null;
	if(self.epg_element == null){
        var element = document.createElement("div");
        element.addClass("channelCol col-4 mx-0 px-0");
        if(selectedChannel == this) {
            element.addClass("selected");
        }
        var header = document.createElement("div");
        header.addClass("epg_chinfo align-items-center sticky-top px-2");
        var logo = document.createElement("img");
        logo.setAttribute("src",self.image || "./images/empty.png");
        logo.setAttribute("alt","channel icon");
        logo.addClass("chicon img-fluid d-block");
        header.appendChild(logo);
        var number = document.createElement("span");
        number.addClass("chnumber d-inline-block float-left");
        number.innerHTML = self.lcn;
        header.appendChild(number);
        var name = document.createElement("span");
        name.addClass("chname text-truncate d-inline-block");
        name.innerHTML = self.title;
        header.appendChild(name);
        element.appendChild(header);
        this.programList = document.createElement("ul");
        this.programList.addClass("list list-group-flush list-programs container-fluid");
        element.appendChild(this.programList);
        self.epg_element = element;
    }
    else {
        $(this.programList).empty();
    }
    if(!self.programs) {
        this.getSchedule(self.populateEPG.bind(self));
    }
    else {
        this.populateEPG();
    }
    return self.epg_element;
}


Channel.prototype.populateEPG = function () {
    var self = this;
    if(self.programs) {
        for(var i = 0;i<self.programs.length;i++) {
            this.programList.appendChild(self.programs[i].populate());
        }
    }
}

//Called when user changes parental rating in the settings
//Program information should be up to date, updated with the programChangeTimer
Channel.prototype.parentalRatingChanged = function(callback) {
    var self = this;
    var serviceInstance = self.getServiceInstance();
    if(self.isProgramAllowed()) {
        $("#notification").hide();
        try {
            if(player.getSource() != serviceInstance.dashUrl) {
                player.attachSource(serviceInstance.dashUrl);
            }
        } catch(e) {
            //player throws an error is there is no souce attached
           player.attachSource(serviceInstance.dashUrl);
        }
    }
    else {
        player.attachSource(null);
        $("#notification").show();
        $("#notification").text(i18n.getString("parental_block"));
    }

}

Channel.prototype.isProgramAllowed = function() {
   if(this.now_next) {
        var now = this.now_next["now"];
        if(now.parentalRating && now.parentalRating.length > 0) {
            for(var i = 0;i < now.parentalRating.length;i++) {
                if(now.parentalRating[i].minimumage && minimumAge < now.parentalRating[i].minimumage) {
                    return false;
                }
            }
        }
    }
    return true;
}
