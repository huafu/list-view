var view, helper;
require('list-view/~tests/test_helper');
helper = window.helper;

function appendView() {
  Ember.run(function() {
    view.appendTo('#qunit-fixture');
  });
}

module("Ember.ListView (horizontal) unit: - startingIndex", {
  teardown: function() {
    Ember.run(function() {
      if (view) { view.destroy(); }
    });
  }
});

test("base case", function(){
  var height = 100, columnWidth = 50, width = 500, elementHeight = 50;

  view = Ember.ListView.create({
    isHorizontal: true,
    height: height,
    columnWidth: columnWidth,
    content: helper.generateContent(5),
    width: width,
    elementHeight: elementHeight,
    scrollOffset: 0
  });

  equal(view._startingIndex(), 0);
});

test("scroll but within content length", function(){
  var height = 100, columnWidth = 50, width = 500, elementHeight = 50;

  view = Ember.ListView.create({
    isHorizontal: true,
    height: height,
    columnWidth: columnWidth,
    content: helper.generateContent(5),
    width: width,
    elementHeight: elementHeight,
    scrollOffset: 100
  });

  equal(view._startingIndex(), 4);
});

test("scroll but beyond content length", function(){
  var height = 100, columnWidth = 50, width = 500, elementHeight = 50;

  view = Ember.ListView.create({
    isHorizontal: true,
    height: height,
    columnWidth: columnWidth,
    content: helper.generateContent(5),
    width: width,
    elementHeight: elementHeight,
    scrollOffset: 1000
  });

  equal(view._startingIndex(), 4);
});

