/* global Parse, _, c3 */
'use strict';

(function() {

  function median(values) {
    values.sort(function(a, b) {
      return a - b;
    });
    var half = Math.floor(values.length / 2);
    if (values.length % 2) {
      return values[half];
    } else {
      return (values[half - 1] + values[half]) / 2.0;
    }
  }

  function average(values) {
    var sum = _.reduce(values, function(sum, num) {
      return sum + num;
    });
    return sum / values.length;
  }

  function variance(values) {
    var avg = average(values);
    var v = 0;
    for (var i = 0; i < values.length; i++) {
      v += Math.pow(values[i] - avg, 2);
    }
    return v / values.length;
  }

  function stdDev(values) {
    return Math.sqrt(variance(values));
  }

  function pad(n, padSize) {
    var str = n.toString();
    var padZeros = (new Array(padSize)).join('0');
    return (padZeros + str).substr(-padSize);
  }

  function iso(d) {
    return [
      pad(d.getFullYear(), 4),
      pad(d.getMonth() + 1, 2),
      pad(d.getDate(d), 2)
    ].join('-');
  }

  function _screen(r) {
    var reasons = [];
    if (!r.recommendation_type) {
      reasons.push('incomplete');
    }
    if (r.survey_control_should_be_1 !== '1') {
      reasons.push('control_question_1');
    }
    if (r.survey_check_1 && r.survey_check_1 !== '3') {
      reasons.push('control_question_2');
    }
    if (r.survey_check_2 && r.survey_check_2 !== '5') {
      reasons.push('control_question_3');
    }
    if (r.played_selection_tracks.length === 0 ||
        r.played_rating_tracks.length === 0 ) {
      reasons.push('no_songs_played');
    }
    if (r.music_time_minutes < 4 ||
        r.time_minutes < 7 ) {
      reasons.push('music_time_lt_4_total_lt_7');
    }
    var acc = !reasons.length;
    return {acc: acc, reasons: reasons};
  }

  function screen(r) {
    return _screen(r).acc;
  }

  var Dashboard = function(result, ratingTracks, selectionTracks) {
    this.ratingTracks = _.pluck(ratingTracks, 'attributes');
    this.selectionTracks = _.pluck(selectionTracks, 'attributes');
    this.resUnfiltered = _.pluck(result, 'attributes');

    this.res = _.filter(this.resUnfiltered, screen);
    this.filtered = _.reject(this.resUnfiltered, screen);

    console.log(this.res.length, this.filtered.length)
    this.recTypes = _.groupBy(this.res, 'recommendation_type');

    this.initAudio = function() {
      this.player = document.createElement('audio');
      this.player.autoplay = false;
      document.body.appendChild(this.player);
      var _this = this;
      $('.play-button').click(function(e){
        var $button = $(e.currentTarget);
        var url = $button.data('url');
        if (_this.player.src === url) {
          _this.stopPlaying();
        } else {
          _this.playUrl(url);
        }
      });
      $(this.player).on('play', function(){
        $('[data-url]').html('<i class="glyphicon glyphicon-play"></i>');
        $('[data-url="'+_this.player.src+'"]').html('<i class="glyphicon glyphicon-stop"></i>');
      });
      $(this.player).on('ended pause', function(){
        $('[data-url="'+_this.player.src+'"]').html('<i class="glyphicon glyphicon-play"></i>');
        _this.player.removeAttribute('src');
      });
    };
    this.playUrl = function(url) {
      this.player.src = url;
      this.player.autoplay = true;
    };
    this.stopPlaying = function() {
      this.player.pause();
    };

    this.songForId = function(id) {
      return _.find(this.selectionTracks, {'deezer_id': id});
    };

    this.count = function() {
      var resUnfilteredDaily = _.groupBy(this.resUnfiltered, function(r) {
        return iso(new Date(r.end_time));
      });
      var keys = _.keys(resUnfilteredDaily).sort();
      var data = [];
      var counts = [];
      keys.forEach(function(k) {
        counts.push(resUnfilteredDaily[k].length);
        data.push({date: k, count: resUnfilteredDaily[k].length});
      });
      var template = $('#participants-count-template').html();
      var t = _.template(template,{'days': data});
      $('#participants-count').after(t);
      // chart
      keys.unshift('x');
      counts.unshift('participants');
      c3.generate({
        data: {
          x: 'x',
          columns: [
            keys,
            counts
          ]
        },
        axis: {
          x: {
            type: 'timeseries',
            tick: {
              format: '%Y-%m-%d'
            }
          }
        }
      });
    };

    this.groups = function() {
      for (var type in this.recTypes) {
        $('#participants-groups-table').append('<tr><td>' + type + '</td><td>' + this.recTypes[type].length + '</td><td>' + 100* (this.recTypes[type].length/this.res.length).toFixed(2) + '%</td></tr>');
      }
      $('#participants-groups-table').append('<tr><td> all groups </td><td>' + this.res.length + '</td><td>100%</td></tr>');
    };

    this.screenOut = function() {
      var reasonsCount = {};
      this.filtered.forEach(function(item){
        var itemReasons = _screen(item).reasons;
        for (var i = 0; i < itemReasons.length; i++) {
          var reason = itemReasons[i];
          if (reasonsCount[reason]) {
            reasonsCount[reason]++;
          } else {
            reasonsCount[reason] = 1;
          }
        }
      });
      console.log(reasonsCount);
      var reasons = _.keys(reasonsCount);
      console.log(reasons);
      //var gi = _.countBy(items, 'reason');
      reasons.forEach(function(reason){
        $('#participants-out-table').append('<tr><td>'+reason+'</td><td>' + reasonsCount[reason] + '</td></tr>');
      });
      $('#participants-out-table').append('<tr><td> all reasons </td><td>' + this.filtered.length + ' (' + 100 * (this.filtered.length/this.resUnfiltered.length).toFixed(2) + '%)</td></tr>');
    };

    this._demographics = function(arr, name, showMax) {
      var total = 0;
      var male = 0;
      var female = 0;
      var ageRanges = {
        maennlich: {
          '15-24': 0,
          '25-34': 0,
          '35-44': 0,
          '45-54': 0,
          '55-59': 0
        },
        weiblich: {
          '15-24': 0,
          '25-34': 0,
          '35-44': 0,
          '45-54': 0,
          '55-59': 0
        }
      };
      var genders = _.groupBy(arr, 'demographics_gender');
      for (var gender in genders) {
        var ages = _.groupBy(genders[gender], 'demographics_age');
        for (var age in ages) {
          var c = ages[age].length;
          ageRanges[gender][age] = c;
          total += c;
          if (gender === 'maennlich') {
            male += c;
          } else {
            female += c;
          }
        }
      }
      var trs = showMax ? [
        '<tr class="text-center">',
          '<td rowspan="3" class="text-left">'+ name +'</td>',
          '<td>'+ageRanges.maennlich['15-24']+' <small class="text-muted">(10)</small></td>',
          '<td>'+ageRanges.maennlich['25-34']+' <small class="text-muted">(10)</small></td>',
          '<td>'+ageRanges.maennlich['35-44']+' <small class="text-muted">(12)</small></td>',
          '<td>'+ageRanges.maennlich['45-54']+' <small class="text-muted">(13)</small></td>',
          '<td>'+ageRanges.maennlich['55-59']+' <small class="text-muted">(5)</small></td>',
          '<td>'+ageRanges.weiblich['15-24']+' <small class="text-muted">(9)</small></td>',
          '<td>'+ageRanges.weiblich['25-34']+' <small class="text-muted">(10)</small></td>',
          '<td>'+ageRanges.weiblich['35-44']+' <small class="text-muted">(12)</small></td>',
          '<td>'+ageRanges.weiblich['45-54']+' <small class="text-muted">(13)</small></td>',
          '<td>'+ageRanges.weiblich['55-59']+' <small class="text-muted">(6)</small></td>',
        '</tr>'
      ].join('') : [
        '<tr class="text-center">',
          '<td rowspan="3" class="text-left">'+ name +'</td>',
          '<td>'+ageRanges.maennlich['15-24']+'</td>',
          '<td>'+ageRanges.maennlich['25-34']+'</td>',
          '<td>'+ageRanges.maennlich['35-44']+'</td>',
          '<td>'+ageRanges.maennlich['45-54']+'</td>',
          '<td>'+ageRanges.maennlich['55-59']+'</td>',
          '<td>'+ageRanges.weiblich['15-24']+'</td>',
          '<td>'+ageRanges.weiblich['25-34']+'</td>',
          '<td>'+ageRanges.weiblich['35-44']+'</td>',
          '<td>'+ageRanges.weiblich['45-54']+'</td>',
          '<td>'+ageRanges.weiblich['55-59']+'</td>',
        '</tr>'
      ].join('');
      trs += ([
        '<tr class="text-center">',
          '<td colspan="5">'+male+'</td>',
          '<td colspan="5">'+female+'</td>',
        '</tr>',
        '<tr class="text-center">',
          '<td colspan="10">'+total+'</td>',
        '</tr>'
      ].join(''));
      $('#participants-demographics-table').append(trs);
    };
    this.demographics = function() {
      for (var type in this.recTypes) {
        this._demographics(this.recTypes[type], type, true);
      }
      this._demographics(this.res, 'all groups');
      this._demographics(_.filter(this.filtered, function(i){return i.demographics_age != null}), 'screened out (exc. incomplete)');
    };

    this._time = function(arr, name) {
      var musicTimes = _.pluck(arr, 'music_time_minutes');
      var overallTimes = _.pluck(arr, 'time_minutes');
      var minMusicTime = _.min(musicTimes);
      var maxMusicTime = _.max(musicTimes);
      var mdMusicTime = median(musicTimes);
      var minTime = _.min(overallTimes);
      var maxTime = _.max(overallTimes);
      var mdTime = median(overallTimes);
      $('#general-behavior-time-table').append(
        '<tr><td>' + name + '</td><td>' + minMusicTime.toFixed(2) + '</td><td>' + maxMusicTime.toFixed(2) + '</td><td>' + mdMusicTime.toFixed(2) + '</td><td>' + minTime.toFixed(2) + '</td><td>' + maxTime.toFixed(2) + '</td><td>' + mdTime.toFixed(2) + '</td></tr>'
      );
    };

    this.time = function() {
      for (var type in this.recTypes) {
        this._time(this.recTypes[type], type);
      }
      this._time(this.res, 'all groups');
    };

    this._playCounts = function(arr, name) {
      function propLength(property) {
        return function(a) {
          return a[property].length;
        };
      }
      var playedRatingCount = _.map(arr, propLength('played_rating_tracks'));
      var playedSelectionCount = _.map(arr, propLength('played_selection_tracks'));
      var playedRecommendationCount = _.map(arr, propLength('played_recommendation_tracks'));
      var minRating = _.min(playedRatingCount);
      var maxRating = _.max(playedRatingCount);
      var mdRating = median(playedRatingCount);
      var maxSelection = _.max(playedSelectionCount);
      var minSelection = _.min(playedSelectionCount);
      var mdSelection = median(playedSelectionCount);
      var minRecommendation = _.min(playedRecommendationCount);
      var maxRecommendation = _.max(playedRecommendationCount);
      var mdRecommendation = median(playedRecommendationCount);
      $('#general-behavior-play-count-table').append(
        ['<tr>',
          '<td>', name, '</td>',
          '<td>', minRating, '</td>',
          '<td>', maxRating, '</td>',
          '<td>', mdRating, '</td>',
          '<td>', minSelection, '</td>',
          '<td>', maxSelection, '</td>',
          '<td>', mdSelection, '</td>',
          '<td>', minRecommendation, '</td>',
          '<td>', maxRecommendation, '</td>',
          '<td>', mdRecommendation, '</td>',
        '</tr>'
        ].join('')
      );
    };

    this.playCounts = function() {
      for (var type in this.recTypes) {
        this._playCounts(this.recTypes[type], type);
      }
      this._playCounts(this.res, 'all groups');
    };

    this.ratings = function() {
      var userRatings = _.pluck(this.res, 'ratings');
      var songRatings = [];
      userRatings.forEach(function(rating) {
        for (var i = 0; i < rating.length; i++) {
          if (songRatings[i]) {
            songRatings[i].push(rating[i]);
          } else {
            songRatings[i] = [rating[i]];
          }
        }
      });
      for (var i = 0; i < songRatings.length; i++) {
        var ratings = songRatings[i];
        var avg = average(ratings).toFixed(2);
        var dev = stdDev(ratings).toFixed(2);
        var song = this.ratingTracks[i];
        var songString = this.ratingTracks[i].artist + ' - ' + this.ratingTracks[i].title;
        $('#ratings-average-table').append('<tr><td class="text-center"><button type="button" class="play-button btn btn-sm btn-default" data-url="'+song.preview+'"><i class="glyphicon glyphicon-play"></i></button></td><td>' + songString + '</td><td>' + avg + '</td><td>' + dev + '</td></tr>');
      }
    };

    this._selection = function(results, name) {
      var selectedTracksObj = {};
      var selectedTrackResults = _.pluck(results, 'selected_tracks');
      selectedTrackResults.forEach(function(selection) {
        for (var i = 0; i < selection.length; i++) {
          if (selectedTracksObj[selection[i]]) {
            selectedTracksObj[selection[i]]++;
          } else {
            selectedTracksObj[selection[i]] = 1;
          }
        }
      });
      var selectedTracks = [];
      for (var track in selectedTracksObj) {
        selectedTracks.push({
          'id': parseInt(track),
          'count': selectedTracksObj[track]
        });
      }
      var topTracks = _.sortBy(selectedTracks, function(song) {
        return -song.count;
      });
      var table = [
        '<h4>',name,'</h4>',
        '<table class="table table-bordered table-middle">',
          '<tr>',
            '<th style="padding: 0 8px; vertical-align: middle; text-align: center"> <img src="images/deezer.png" style="height: 36px" alt="deezer-logo"></th>',
            '<th>Song</th>',
            '<th>Selected Count</th>',
          '</tr>'
      ].join('');
      for (var i = 0; i < 10; i++) {
        var song = this.songForId(topTracks[i].id);
        var songString = song.artist + ' - ' + song.title;
        table += [
          '<tr>',
            '<td class="text-center"><button type="button" class="play-button btn btn-sm btn-default" data-url="'+song.preview+'"><i class="glyphicon glyphicon-play"></i></button></td>',
            '<td>' + songString + '</td>',
            '<td>' + topTracks[i].count + '</td>',
          '</tr>'
        ].join('');
      }
      table += '</table>';
      $('#selection-top-10').after(table);
    };

    this.selection = function() {
      for (var type in this.recTypes) {
        this._selection(this.recTypes[type], type);
      }
    };

    this.acceptance = function() {
      var data = [];
      for (var type in this.recTypes) {
        var counts = _.pluck(this.recTypes[type],'selected_recommendation_track_count');
        data.push({
          type: type,
          min: _.min(counts),
          max: _.max(counts),
          md: median(counts),
          mn: average(counts)
        });
      }
      console.log(data);
      var template = $('#recommendations-acceptance-template').html();
      var t = _.template(template,{'types': data});
      $('#recommendations-acceptance').after(t);
    };

    this.initialize = function() {
      this.count();
      this.screenOut();
      this.groups();
      this.demographics();
      this.time();
      this.playCounts();
      this.ratings();
      this.selection();
      this.acceptance();
      this.initAudio();
    };
  };

  Parse.initialize('70ARDceBYgrNoRL6yJDgFubIPUZzpwKRbVVESwZC', 'qNd9A8mBLkG4hrQ2M4URnP0MyQ7Bs72AbvTXhInb');

  var result;
  var ratingTracks;
  var selectionTracks;

  var start = function() {
    if (result && selectionTracks && ratingTracks) {
      console.log(result, result.length);
      var dashboard = new Dashboard(result, ratingTracks, selectionTracks);
      dashboard.initialize();
      $('#loader').addClass('hidden');
      $('#container').removeClass('invisible');
      $('[data-spy="scroll"]').each(function () {
        $(this).scrollspy('refresh');
      });
    }
  };

  var r = Parse.Object.extend('Result');
  var rq = new Parse.Query(r);
  rq.limit(1000);
  rq.find().then(function(res) {
    result = res;
    start();
  });

  var rt = Parse.Object.extend('RatingTrack');
  var rtq = new Parse.Query(rt);
  rtq.find().then(function(res) {
    ratingTracks = res;
    start();
  });

  var st = Parse.Object.extend('SelectionTrack');
  var stq = new Parse.Query(st);
  stq.limit(500);
  stq.find().then(function(res) {
    selectionTracks = res;
    start();
  });

})();
