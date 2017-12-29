// Created with Squiffy 5.1.1
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '12cc6a9dd3';
squiffy.story.sections = {
	'_default': {
		'text': "<h1 id=\"-a-class-squiffy-link-link-section-data-section-should-i-do-the-thing-role-link-tabindex-0-should-i-do-the-thing-a-\"><a class=\"squiffy-link link-section\" data-section=\"Should I do the thing?\" role=\"link\" tabindex=\"0\">Should I do the thing?</a></h1>",
		'passages': {
		},
	},
	'Should I do the thing?': {
		'text': "<h3 id=\"is-the-thing-worth-doing-\">Is the thing worth doing?</h3>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"y\" role=\"link\" tabindex=\"0\">y</a> yes</li>\n<li><a class=\"squiffy-link link-section\" data-section=\"n\" role=\"link\" tabindex=\"0\">n</a> no</li>\n</ul>",
		'passages': {
		},
	},
	'y': {
		'text': "<h3 id=\"is-it-worth-doing-by-me-in-particular-\">Is it worth doing by me in particular?</h3>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"yy\" role=\"link\" tabindex=\"0\">yy</a> yes!</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"yn\" role=\"link\" tabindex=\"0\">no</a>, someone else is better suited.</li>\n</ul>",
		'passages': {
			'yn': {
				'text': "<h3 id=\"wait-a-hot-minute-is-this-impostor-syndrome-https-www-scientificamerican-com-article-what-is-impostor-syndrome-talk-\">Wait a hot minute. Is this <a href=\"https://www.scientificamerican.com/article/what-is-impostor-syndrome/\">impostor syndrome</a> talk?</h3>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"yy\" role=\"link\" tabindex=\"0\">yy</a> oops, yes, haha :) nevermind!</li>\n<li><a class=\"squiffy-link link-section\" data-section=\"dontdo\" role=\"link\" tabindex=\"0\">dontdo</a> no, I am legitimately unqualified, and am only considering the thing as an advanced form of procrastination from the thing I <em>actually</em> mean to be doing, and/or the thing that is actually a better way <em>for me</em> to contribute to humanity/society/knowledge/art/environment</li>\n</ul>",
			},
		},
	},
	'yy': {
		'text': "<h3 id=\"will-doing-the-thing-require-a-surprising-amount-of-resources-time-energy-money-or-goodwill-\">Will doing the thing require a surprising amount of resources (time, energy, money, or goodwill)?</h3>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"nope\" role=\"link\" tabindex=\"0\">nope</a>, this is going to go swimmingly and precisely as I plan it!</li>\n</ul>",
		'passages': {
		},
	},
	'nope': {
		'text': "<h3 id=\"that-seems-unlikely-so-let-s-imagine-that-it-will-become-a-surprising-burden-in-_some_-way-how-far-over-its-budget-of-time-energy-money-or-goodwill-can-the-thing-go-and-still-be-worth-doing-_and_-worth-doing-_by-me_-\">That seems unlikely, so let&#39;s imagine that it will become a surprising burden in <em>some</em> way. How far over its budget (of time, energy, money, or goodwill) can the thing go and still be worth doing, <em>and</em> worth doing <em>by me</em>?</h3>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"spreadthin\" role=\"link\" tabindex=\"0\">spreadthin</a> Not at all! I am an extremely busy person already spread exceptionally thin.</li>\n<li><a class=\"squiffy-link link-section\" data-section=\"23x\" role=\"link\" tabindex=\"0\">23x</a> Like, twice or three times what I imagine.</li>\n<li><a class=\"squiffy-link link-section\" data-section=\"infinity\" role=\"link\" tabindex=\"0\">infinity</a> It doesn&#39;t matter, the thing is my ultimate calling, it can sap me dry and I will be the happier for it!</li>\n</ul>",
		'passages': {
		},
	},
	'infinity': {
		'text': "<p>That is demonstrably an unproductive way to go, because I am a fragile body in space with 24 hours in each day, several of them - ideally - asleep, and the wakeful ones permeated by the looming spectre of inescapable mortality. Therefore:</p>\n<h1 id=\"i-will-not-neglect-myself-in-the-name-of-the-thing-\">I will not neglect myself in the name of the thing.</h1>\n<p>Firstly, because it is unkind to myself and normalizes this kind of behavior to others. Secondly, because if I neglect myself, I will quickly be unable to do the thing well, or maybe at all, and there is no place for that kind of irony in the wide-eyed quest for productivity!</p>\n<p>Instead, I will:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"scope the thing\" role=\"link\" tabindex=\"0\">scope the thing</a> down to something more </li>\n</ul>",
		'passages': {
		},
	},
	'23x': {
		'text': "<h1 id=\"i-will-do-the-thing-\">I will do the thing!</h1>\n<p>But also I will make sure to articulate measurable goals and keep myself accountable, and, if it turns out the thing metastasizes to other areas of life, I will seriously consider not doing the thing anymore. I will not let the sunk cost fallacy dictate my sanity.</p>",
		'passages': {
		},
	},
	'finalyes': {
		'text': "<h1 id=\"i-will-do-the-thing-\">I will do the thing!</h1>\n<p>(and maybe, just maybe I might leave comments or suggestions for this thing on <a href=\"https://www.facebook.com/photo.php?fbid=10208065569305025&amp;set=a.2092313835444.2107842.1473210122&amp;type=3&amp;theater\">this public FB post</a>...)</p>",
		'passages': {
		},
	},
	'spreadthin': {
		'text': "<h3 id=\"wait-so-why-am-i-considering-doing-the-thing-\">Wait, so why am I considering doing the thing?</h3>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"opportunity\" role=\"link\" tabindex=\"0\">opportunity</a> I feel an all-consuming desire to sneak into a narrow window of opportunity.</li>\n<li><a class=\"squiffy-link link-section\" data-section=\"sayno\" role=\"link\" tabindex=\"0\">sayno</a> Someone asked me to do the thing, and saying &quot;no&quot; to them is hard.</li>\n</ul>",
		'passages': {
		},
	},
	'sayno': {
		'text': "<p> Saying &quot;no&quot; <em>is</em> really hard!</p>\n<p>But it&#39;s even hard to say &quot;no&quot; from under a guilt-ridden pile of incomplete work while apologizing and shaking from 2 hours of sleep.</p>\n<h1 id=\"i-shouldn-t-do-the-thing-and-i-already-know-it-\">I shouldn&#39;t do the thing and I already know it.</h1>",
		'passages': {
		},
	},
	'opportunity': {
		'text': "<p>The sense of a quickly-evaporating opportunity is, for the <em>vast majority</em> of things, imaginary.</p>\n<p>If the thing is worth doing, it&#39;ll be worth doing next year. If next year I consider the thing and I am still unable to make sufficient room in my life for it, then I will be grateful and happy that my life is filled with such meaningful things worth doing already.</p>\n<h1 id=\"i-will-not-do-the-thing-and-also-i-will-consider-taking-a-nice-walk-right-now-why-not-life-is-short-and-beautiful-\">I will not do the thing, and also I will consider taking a nice walk, right now, why not, life is short and beautiful.</h1>",
		'passages': {
		},
	},
	'dontdo': {
		'text': "<h1 id=\"i-will-do-some-other-thing-there-are-lots-of-things-i-can-do-\">I will do some other thing. There are lots of things I can do!</h1>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"but\" role=\"link\" tabindex=\"0\">but</a> other people tell me my options are limited...</li>\n</ul>",
		'passages': {
		},
	},
	'but': {
		'text': "<p>When people give advice, even in the best conscience and with excellent relevant experience, they are speaking to their own past selves. I don&#39;t have to accept their words at face value, but I can still benefit from them and be greatful for them.</p>",
		'passages': {
		},
	},
	'n': {
		'text': "<h3 id=\"is-it-wrong-to-do-relative-to-my-values-\">Is it wrong to do, relative to my values?</h3>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"ny\" role=\"link\" tabindex=\"0\">yes</a>, <em>but</em>....</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"nn\" role=\"link\" tabindex=\"0\">not <em>actively</em> wrong</a> but also not <em>right</em>...</li>\n</ul>",
		'passages': {
			'ny': {
				'text': "<h3 id=\"is-it-necessary-\">Is it necessary?</h3>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"dontdo\" role=\"link\" tabindex=\"0\">dontdo</a> nope</li>\n<li><a class=\"squiffy-link link-section\" data-section=\"kindayes\" role=\"link\" tabindex=\"0\">kindayes</a> right now, it is 100% inescapable</li>\n</ul>",
			},
			'nn': {
				'text': "<h3 id=\"will-it-expand-my-imagination-or-capability-\">Will it expand my imagination or capability?</h3>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"nnn\" role=\"link\" tabindex=\"0\">no...</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"kindayes\" role=\"link\" tabindex=\"0\">kindayes</a> yes!</li>\n</ul>",
			},
			'nnn': {
				'text': "<h3 id=\"will-it-allow-me-to-have-more-resources-for-other-things-which-are-good-and-important-\">Will it allow me to have more resources for other things, which are good and important?</h3>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"ny\" role=\"link\" tabindex=\"0\">no...</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"kindayes\" role=\"link\" tabindex=\"0\">kindayes</a> <a class=\"squiffy-link link-passage\" data-passage=\"kindayes\" role=\"link\" tabindex=\"0\">yes!</a></li>\n</ul>",
			},
		},
	},
	'kindayes': {
		'text': "<h1 id=\"nothing-is-over-until-it-s-over-\">Nothing is over until it&#39;s over.</h1>\n<p>I will do the thing, but work to change my life so that something which feels <em>so wrong</em> is not <em>so necessary</em>. </p>\n<ul>\n<li>Change may take time, and</li>\n<li>many things may be out of my influence, and</li>\n<li>much may not turn out as I hope, so:</li>\n</ul>\n<p>Ss long as I am doing my best, I will not punish myself unnecessarily for doing the thing, even if it goes against some of my values.</p>",
		'passages': {
		},
	},
}
})();