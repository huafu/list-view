var css, view, helper;
require('list-view/~tests/test_helper');
helper = window.helper;

function appendView() {
  Ember.run(function() {
    view.appendTo('#qunit-fixture');
  });
}

module("Ember.ListView (horizontal) integration - Content", {
  setup: function() {
    css = Ember.$("<style>" +
            ".ember-list-view {" +
            "  overflow: auto;" +
            "  position: relative;" +
            "}" +
            ".ember-list-item-view {" +
            "  position: absolute;" +
            "}" +
            ".is-selected {" +
            "  background: red;" +
            "}" +
            "</style>").appendTo('head');
  },
  teardown: function() {
    css.remove();

    Ember.run(function() {
      if (view) { view.destroy(); }
    });
  }
});

test("replacing the horizontal list content", function() {
  var content = helper.generateContent(100),
      width = 500,
      columnWidth = 50,
      itemViewClass = Ember.ListItemView.extend({
        template: Ember.Handlebars.compile("{{name}}")
      });

  view = Ember.ListView.create({
    isHorizontal: true,
    content: content,
    width: width,
    columnWidth: columnWidth,
    itemViewClass: itemViewClass
  });

  appendView();

  Ember.run(function() {
    view.set('content', Ember.A([{name: 'The only item'}]));
  });

  equal(view.$('.ember-list-item-view').length, 1, "The rendered list was updated");
  equal(view.$('.ember-list-container').width(), 50, "The scrollable view has the correct width");
});

test("adding to the front of the horizontal list content", function() {
  var content = helper.generateContent(100),
      width = 500,
      columnWidth = 50,
      itemViewClass = Ember.ListItemView.extend({
        template: Ember.Handlebars.compile("{{name}}")
      });

  view = Ember.ListView.create({
    isHorizontal: true,
    content: content,
    width: width,
    columnWidth: columnWidth,
    itemViewClass: itemViewClass
  });

  appendView();

  Ember.run(function() {
    content.unshiftObject({name: "Item -1"});
  });

  var positionSorted = helper.sortElementsByPositionForHorizList(view.$('.ember-list-item-view'));
  equal(Ember.$(positionSorted[0]).text(), "Item -1", "The item has been inserted in the list");
  equal(view.$('.ember-list-container').width(), 5050, "The scrollable view has the correct width");
});
