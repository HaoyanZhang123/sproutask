window.__ModuleLoader__.load({
	id: "@edu/probe-root",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const inject = ["slots"];
		function apply(ctx) {
			document.title = "EduProbe Root (T00)";
			ctx.slots.register(
				{ name: "root", locale: "common" },
				function EduProbeRoot() {
					return react.createElement(
						"div",
						{ id: "edu-probe-root", "data-probe": "T00" },
						react.createElement("h1", null, "EDU PROBE ROOT"),
						react.createElement("p", null, "T00 isolated root occupant"),
					);
				},
			);
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
