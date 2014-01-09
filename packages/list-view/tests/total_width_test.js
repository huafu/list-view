var view, helper;
require('list-view/~tests/test_helper');
helper = window.helper;

function appendView() {
  Ember.run(function() {
    view.appendTo('#qunit-fixture');
  });
}

module("Ember.ListView (horizontal) unit - totalWidth", {
  teardown: function() {
    Ember.run(function() {
      if (view) { view.destroy(); }
    });
  }
});

test("single row", function(){
  var width = 500, columnWidth = 50;

  view = Ember.ListView.create({
    isHorizontal: true,
    width: width,
    columnWidth: columnWidth,
    content: helper.generateContent(20)
  });

  equal(view.get('totalWidth'), 1000);
});

test("even", function(){
  var width = 500, columnWidth = 50, height = 100, elementHeight = 50;

  view = Ember.ListView.create({
    isHorizontal: true,
    width: width,
    columnWidth: columnWidth,
    content: helper.generateContent(20),
    height: height,
    elementHeight: elementHeight
  });

  equal(view.get('totalWidth'), 500);
});

test("odd", function(){
  var width = 500, columnWidth = 50, height = 100, elementHeight = 50;

  view = Ember.ListView.create({
    isHorizontal: true,
    width: width,
    columnWidth: columnWidth,
    content: helper.generateContent(21),
    height: height,
    elementHeight: elementHeight
  });

  equal(view.get('totalWidth'), 550);
});

test("with rightPadding", function(){
  var width = 500, columnWidth = 50, height = 100, elementHeight = 50;

  view = Ember.ListView.create({
    isHorizontal: true,
    width: width,
    columnWidth: columnWidth,
    content: helper.generateContent(20),
    height: height,
    elementHeight: elementHeight,
    rightPadding: 25
  });

  equal(view.get('totalWidth'), 525);
});
