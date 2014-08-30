/* global Parse, _ */
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

  var Dashboard = function(result, ratingTracks, selectionTracks) {
    this.ratingTracks = _.pluck(ratingTracks, 'attributes');
    this.selectionTracks = _.pluck(selectionTracks, 'attributes');
    this.res = _.pluck(result, 'attributes');
    this.recTypes = _.groupBy(this.res, 'recommendation_type');

    this.songNameForId = function(id) {
      var s = _.find(this.selectionTracks, {'deezer_id': id});
      return s.artist + ' - ' + s.title;
    };

    this.count = function() {
      for (var type in this.recTypes) {
        $('#count').append('<tr><td>' + type + '</td><td>' + this.recTypes[type].length + '</td></tr>');
      }
      $('#count').append('<tr><td> all groups </td><td>' + this.res.length + '</td></tr>');
    };

    this.demographics = function() {
      for (var type in this.recTypes) {
        var genders = _.groupBy(this.recTypes[type], 'demographics_gender');
        for (var gender in genders) {
          var ages = _.groupBy(genders[gender], 'demographics_age');
          for (var age in ages) {
            $('#demographics').append(
              '<tr><td>' + type + '</td><td>' + gender + '</td><td>' + age + '</td><td>' + ages[age].length + '</td></tr>'
            );
          }
        }
      }
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
      $('#time').append(
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
      $('#play-count').append(
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
        var song = this.ratingTracks[i].artist + ' - ' + this.ratingTracks[i].title;
        $('#ratings').append('<tr><td>' + song + '</td><td>' + avg + '</td><td>' + dev + '</td></tr>');
      }
    };

    this.selection = function() {
      var selectedTracksObj = {};
      var selectedTrackResults = _.pluck(this.res, 'selected_tracks');
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
      for (var i = 0; i < 10; i++) {
        $('#selection').append('<tr><td>' + this.songNameForId(topTracks[i].id) + '</td><td>' + topTracks[i].count + '</td></tr>');
      }
    };

    this.initialize = function() {
      this.count();
      this.demographics();
      this.time();
      this.playCounts();
      this.ratings();
      this.selection();
    };
  };

  Parse.initialize('70ARDceBYgrNoRL6yJDgFubIPUZzpwKRbVVESwZC', 'qNd9A8mBLkG4hrQ2M4URnP0MyQ7Bs72AbvTXhInb');

  var result;
  var ratingTracks;
  var selectionTracks;

  var start = function() {
    if (result && selectionTracks && ratingTracks) {
      var dashboard = new Dashboard(result, ratingTracks, selectionTracks);
      dashboard.initialize();
      $('#loader').addClass('hidden');
      $('#container').removeClass('hidden');
    }
  };

  var r = Parse.Object.extend('Result');
  var rq = new Parse.Query(r);
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
