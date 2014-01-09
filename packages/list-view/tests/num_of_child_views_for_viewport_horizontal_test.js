var view, helper;
require('list-view/~tests/test_helper');
helper = window.helper;

function appendView() {
  Ember.run(function() {
    view.appendTo('#qunit-fixture');
  });
}

module("Ember.ListView (horizontal) unit: - numOfChildViewsForViewport", {
  teardown: function() {
    Ember.run(function() {
      if (view) { view.destroy(); }
    });
  }
});

test("computing the number of child views to create with scrollOffset zero", function() {
  view = Ember.ListView.create({
    isHorizontal: true,
    width: 500,
    columnWidth: 50,
    content: Ember.A()
  });

  equal(view._numChildViewsForViewport(), 11);
});

test("computing the number of child views to create after when scroll down a bit", function() {
  view = Ember.ListView.create({
    isHorizontal: true,
    width: 500,
    columnWidth: 50,
    scrollOffset: 51,
    content: Ember.A()
  });
  equal(view._numChildViewsForViewport(), 11);
});

