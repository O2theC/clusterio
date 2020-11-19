"use strict";
const libPlugin = require("@clusterio/lib/plugin");
const { Gauge } = require("@clusterio/lib/prometheus");
const libHelpers = require("@clusterio/lib/helpers");


const instancePlayerCount = new Gauge(
	"clusterio_statistics_exporter_instance_player_count", "Amount of players connected to this cluster",
	{ labels: ["instance_id"] }
);
const instanceGameTicksTotal = new Gauge(
	"clusterio_statistics_exporter_instance_game_ticks_total", "Game tick an instance has progressed to",
	{ labels: ["instance_id"] }
);
const instanceForceFlowStatistics = new Gauge(
	"clusterio_statistics_exporter_instance_force_flow_statistics", "Items/fluids/enemies/buildings produced/built/killed by a force",
	{ labels: ["instance_id", "force", "statistic", "direction", "name"] },
);
const instanceGameFlowStatistics = new Gauge(
	"clusterio_statistics_exporter_instance_game_flow_statistics", "Pollution produced/consumed in the game",
	{ labels: ["instance_id", "statistic", "direction", "name"] },
);


class InstancePlugin extends libPlugin.BaseInstancePlugin {
	async init() {
		if (!this.instance.config.get("factorio.enable_save_patching")) {
			throw new Error("statistics_exporter plugin requires save patching.");
		}
	}

	async gatherMetrics() {
		let string = await this.sendRcon("/sc statistics_exporter.export()");
		let stats;
		try {
			stats = JSON.parse(string);
		} catch (err) {
			throw new Error(`Error parsing statistics JSON: ${err.message}, content "${string}"`);
		}

		let instanceId = this.instance.config.get("instance.id");
		instanceGameTicksTotal.labels(String(instanceId)).set(stats.game_tick);
		instancePlayerCount.labels(String(instanceId)).set(stats.player_count);

		for (let [forceName, flowStatistics] of Object.entries(stats.force_flow_statistics)) {
			for (let [statisticName, statistic] of Object.entries(flowStatistics)) {
				for (let [direction, counts] of Object.entries(statistic)) {
					for (let [item, value] of Object.entries(counts)) {
						instanceForceFlowStatistics.labels(
							String(instanceId), forceName, statisticName, direction, item
						).set(value);
					}
				}
			}
		}

		for (let [direction, counts] of Object.entries(stats.game_flow_statistics.pollution_statistics)) {
			for (let [item, value] of Object.entries(counts)) {
				instanceGameFlowStatistics.labels(
					String(instanceId), "pollution_statistics", direction, item
				).set(value);
			}
		}
	}

	async onMetrics() {
		// Wait up to 5 seconds for the metrics to be collected.  It may
		// take a long time for the command to go through if the command
		// stream is overloaded.  Should this take more than 5 seconds the
		// previous values for the metrics will end up being sent to master.
		await libHelpers.timeout(this.gatherMetrics(), 5e3);
	}
}

module.exports = {
	InstancePlugin,

	// For testing only
	_instancePlayerCount: instancePlayerCount,
	_instanceGameTicksTotal: instanceGameTicksTotal,
	_instanceForceFlowStatistics: instanceForceFlowStatistics,
	_instanceGameFlowStatistics: instanceGameFlowStatistics,
};
