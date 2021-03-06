'use strict';

const fs = require('fs');
const path = require('path');
const GIFEncoder = require('gifencoder');
const Canvas = require('canvas');
const moment = require('moment');

var momentTimezone = require('moment-timezone');

module.exports = {
    /**
     * Initialise the GIF generation
     * @param {string} time
     * @param {number} width
     * @param {number} height
     * @param {string} color
     * @param {string} bg
     * @param {string} name
     * @param {number} frames
     * @param {requestCallback} cb - The callback that is run once complete.
     */
    init: function (time, width = 640, height = 80, color = 'ffe600', bg = '000000', name = 'default', frames = 30, cb, timezone = 'uk', datepassedtext = 'Date has passed!') {
        // Set some sensible upper / lower bounds
        this.width = this.clamp(width, 150, 1000);
        this.height = this.clamp(height, 150, 500);
        this.frames = this.clamp(frames, 1, 90);

        this.bg = '#' + bg;
        this.textColor = '#' + color;
        this.name = name;
        this.timezone = timezone;
        this.datepassedtext = datepassedtext;

        // loop optimisations
        this.halfWidth = Number(this.width / 2);
        this.halfHeight = Number(this.height / 2);

        this.encoder = new GIFEncoder(this.width, this.height);
        this.canvas = new Canvas(this.width, this.height);
        this.ctx = this.canvas.getContext('2d');

        // calculate the time difference (if any)
        let timeResult = this.time(time);

        // start the gif encoder
        this.encode(timeResult, cb);
    },

    calcTime: function (city, offset) {

        // create Date object for current location
        var d = new Date();

        // convert to msec
        // add local time zone offset
        // get UTC time in msec
        var utc = d.getTime() + (d.getTimezoneOffset() * 60000);

        // create new Date object for different city
        // using supplied offset
        var nd = new Date(utc + (3600000 * offset));

        // return time as a string
        return "The local time in " + city + " is " + nd.toLocaleString();
    },
    /**
     * Limit a value between a min / max
     * @link http://stackoverflow.com/questions/11409895/whats-the-most-elegant-way-to-cap-a-number-to-a-segment
     * @param number - input number
     * @param min - minimum value number can have
     * @param max - maximum value number can have
     * @returns {number}
     */
    clamp: function (number, min, max) {
        return Math.max(min, Math.min(number, max));
    },
    /**
     * Calculate the diffeence between timeString and current time
     * @param {string} timeString
     * @returns {string|Object} - return either the date passed string, or a valid moment duration object
     */
    time: function (timeString) {
        // grab the current and target time

        var target = momentTimezone.tz(timeString, "Europe/London");
        var current = momentTimezone.tz("Europe/London");

        if (this.timezone === 'nl') {
            target = momentTimezone.tz(timeString, "Europe/Amsterdam");
            current = momentTimezone.tz("Europe/Amsterdam");
        } else if (this.timezone === 'ru') {
            target = momentTimezone.tz(timeString, "Europe/Moscow");
            current = momentTimezone.tz("Europe/Moscow");
        } else if (this.timezone === 'uk') {
            target = momentTimezone.tz(timeString, "Europe/London");
            current = momentTimezone.tz("Europe/London");
        }

        // difference between the 2 (in ms)
        let difference = target.diff(current);

        console.log('Target: ' + target.format('YYYY-MM-DD HH:mm') + ' Zone: ' + this.timezone.toUpperCase());
        console.log('Current: ' + current.format('YYYY-MM-DD HH:mm') + ' Zone: ' + this.timezone.toUpperCase());
        console.log('Difference: ' + moment.duration(difference));

        // either the date has passed, or we have a difference
        if (difference <= 0) {
            return this.datepassedtext || 'Date has passed!';
        } else {
            // duration of the difference
            return moment.duration(difference);
        }
    },
    drawMessage: function(message, x, y) {
      this.ctx.fillText(message, x, y);
    },
    drawLine: function(x, y) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, y || 15);
      this.ctx.lineTo(x, y || 130);
      this.ctx.lineWidth = 2;
      // set line color
      this.ctx.strokeStyle = '#ffe600';
      this.ctx.stroke();
    },
    setTrack: function (ctx) {
        ctx.strokeStyle = 'hsla(2, 8%, 46%, 0.45)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(36, 36, 27, 0, Math.PI * 2);
        ctx.stroke();
    },
    /**
     * Encode the GIF with the information provided by the time function
     * @param {string|Object} timeResult - either the date passed string, or a valid moment duration object
     * @param {requestCallback} cb - the callback to be run once complete
     */
    encode: function (timeResult, cb) {
        let enc = this.encoder;
        let ctx = this.ctx;
        let tmpDir = process.cwd() + '/tmp/';

        // create the tmp directory if it doesn't exist
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir);
        }

        let filePath = tmpDir + this.name + '.gif';

        // pipe the image to the filesystem to be written
        let imageStream = enc
            .createReadStream()
            .pipe(fs.createWriteStream(filePath));
        // once finised, generate or serve
        imageStream.on('finish', () => {
            // only execute callback if it is a function
            typeof cb === 'function' && cb();
        });

        // estimate the font size based on the provided width
        let fontSize = Math.floor(this.width / 12) + 'px';
        let fontFamily = 'Courier New'; // monospace works slightly better


        // set the font style
        ctx.font = [fontSize, fontFamily].join(' ');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // start encoding gif with following settings
        enc.start();
        enc.setRepeat(0);
        enc.setDelay(1000);
        enc.setQuality(10);

        // if we have a moment duration object
        if (typeof timeResult === 'object') {
            for (let i = 0; i < this.frames; i++) {
                // extract the information we need from the duration
                let days = Math.floor(timeResult.asDays());
                let hours = Math.floor(timeResult.asHours() - (days * 24));
                let minutes = Math.floor(timeResult.asMinutes()) - (days * 24 * 60) - (hours * 60);
                let seconds = Math.floor(timeResult.asSeconds()) - (days * 24 * 60 * 60) - (hours * 60 * 60) - (minutes * 60);
                let timezone = this.timezone;

                // make sure we have at least 2 characters in the string
                days = (days.toString().length == 1) ? '0' + days : days;
                hours = (hours.toString().length == 1) ? '0' + hours : hours;
                minutes = (minutes.toString().length == 1) ? '0' + minutes : minutes;
                seconds = (seconds.toString().length == 1) ? '0' + seconds : seconds;

                // build the date string

                // paint BG
                ctx.fillStyle = this.bg;
                ctx.fillRect(0, 0, this.width, this.height);

                // paint text
                ctx.fillStyle = this.textColor;

                // DAYS
                var metrics = ctx.measureText("DAYS");
                var textWidth = metrics.width;
                var xPosition = (this.canvas.width/2) - (textWidth/2);
                var yPosition = (this.canvas.height/2);

                ctx.font = "800 50pt helvetica";
                this.drawMessage(days, 125, 60);
                ctx.font = "800 10pt helvetica";
                this.drawMessage("DAYS", 125, 100 + (10 / 2));

                // First line
                this.drawLine(190);

                // HOURS
                ctx.font = "300 50pt helvetica";
                this.drawMessage(hours, 250, 60);
                ctx.font = "300 10pt helvetica";
                this.drawMessage("HOURS", 250, 100 + (10 / 2));

                // Second Line
                this.drawLine(315);

                // MINUTES
                ctx.font = "300 50pt helvetica";
                this.drawMessage(minutes, 375, 60);
                ctx.font = "300 10pt helvetica";
                this.drawMessage("MINUTES", 375, 100 + (10 / 2));

                // Third Line
                this.drawLine(440);

                // SECONDS
                ctx.font = "300 50pt helvetica";
                this.drawMessage(seconds, 500, 60);
                ctx.font = "300 10pt helvetica";
                this.drawMessage("SECONDS", 505, 100 + (10 / 2));

                let string = [days, 'd ', hours, 'h ', minutes, 'm ', seconds, 's'].join('');

                console.log('string: ' + string);

                // add finalised frame to the gif
                enc.addFrame(ctx);

                // remove a second for the next loop
                timeResult.subtract(1, 'seconds');
            }
        } else {
            // Date has passed so only using a string

            // BG
            ctx.fillStyle = this.bg;
            ctx.fillRect(0, 0, this.width, this.height);

            // Text
            ctx.fillStyle = this.textColor;
            this.drawMessage(timeResult, this.halfWidth, this.halfHeight);
            enc.addFrame(ctx);
        }

        // finish the gif
        enc.finish();
    }
};
