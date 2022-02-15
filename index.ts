import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import * as pulumi from "@pulumi/pulumi";

const project = pulumi.getProject();
const config = new pulumi.Config();

const provider = new k8s.Provider("k8s", {
  context: config.require("kubeconfig_context"),
  namespace: "monitoring",
});

const victoriaMetricsStack = new k8s.helm.v3.Release(
  "victoria",
  {
    chart: "victoria-metrics-k8s-stack",
    version: "0.7.0",
    repositoryOpts: {
      repo: "https://victoriametrics.github.io/helm-charts/",
    },
    values: {
      grafana: {
        //        env: {
        //          GF_PLUGINS_ENABLE_ALPHA: "true",
        //        },
        plugins: ["camptocamp-prometheus-alertmanager-datasource"],
        sidecar: { datasources: { jsonData: { manageAlerts: false } } },
        datasources: {
          "alertmanager.yaml": {
            apiVersion: 1,
            datasources: [
              {
                name: "alertmanager",
                type: "camptocamp-prometheus-alertmanager-datasource",
                url: "http://vmalertmanager-stack.monitoring.svc:9093",
                access: "proxy",
              },
            ],
          },
          "loki.yaml": {
            apiVersion: 1,
            datasources: [
              {
                name: "loki",
                type: "loki",
                url: "http://loki.monitoring.svc:3100",
                access: "proxy",
                jsonData: {
                  manageAlerts: false,
                },
              },
            ],
          },
        },
      },
      kubeEtcd: {
        enabled: false,
      },
      fullnameOverride: "stack",
      "prometheus-node-exporter": {
        hostRootFsMount: false,
      },
    },
  },
  { provider: provider }
);

const loki = new k8s.helm.v3.Release(
  "loki",
  {
    chart: "loki",
    version: "2.9.1",
    repositoryOpts: {
      repo: "https://grafana.github.io/helm-charts",
    },
    values: {
      fullnameOverride: "loki",
    },
  },
  { provider: provider }
);

const promtail = new k8s.helm.v3.Release(
  "promtail",
  {
    chart: "promtail",
    version: "3.11.0",
    repositoryOpts: {
      repo: "https://grafana.github.io/helm-charts",
    },
    values: {
      config: {
        lokiAddress: "http://loki.monitoring.svc:3100/loki/api/v1/push",
        snippets: {
          extraRelabelConfigs: [
            {
              source_labels: ["__meta_kubernetes_namespace"],
              action: "keep",
              regex: "monitoring",
            },
          ],
        },
      },
    },
  },
  { provider: provider }
);
