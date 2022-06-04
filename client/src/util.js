import get from 'lodash/get';

export function findServicesMatchingDoc(docsToSearch, doc) {
  const containers = get(doc, 'spec.template.spec.containers') || [];
  const labels = get(doc, 'spec.template.metadata.labels') || {};
  return docsToSearch
    .filter((doc) => doc.kind === 'Service')
    .filter((service) => {
      const selector = get(service, 'spec.selector', {});
      const selectorKeys = Object.keys(
        typeof selector === 'object' ? selector : {},
      );
      const matchingLabels =
        selectorKeys.filter((key) => selector[key] === labels[key]).length ===
        selectorKeys.length;

      return (
        matchingLabels &&
        containers.find((container) => {
          return (Array.isArray(get(container, 'ports')) ? container.ports : [])
            .filter((o) => o && typeof o === 'object')
            .find((containerPort) => {
              return (
                Array.isArray(get(service, 'spec.ports'))
                  ? service.spec.ports
                  : []
              ).find((servicePort) => {
                return (
                  servicePort.targetPort === containerPort.containerPort ||
                  servicePort.port === containerPort.containerPort ||
                  servicePort.targetPort === containerPort.name
                );
              });
            });
        })
      );
    });
}

export function findIngressesMatchingServices(docsToSearch, serviceDocs) {
  return docsToSearch
    .filter((doc) => doc.kind === 'Ingress')
    .filter((ingress) =>
      serviceDocs.find((service) => {
        return get(service, 'spec.ports', []).find((port) => {
          if (
            get(ingress, 'spec.backend.serviceName', null) ===
              get(service, 'metadata.name') &&
            (get(ingress, 'spec.backend.servicePort', null) === port.port ||
              get(ingress, 'spec.backend.servicePort', null) === port.name)
          ) {
            return true;
          }
          return get(ingress, 'spec.rules', []).find((rule) => {
            return get(rule, 'http.paths', []).find((path) => {
              const serviceName = get(service, 'metadata.name');
              const legacyIngressMatch =
                serviceName === get(path, 'backend.serviceName', null) &&
                (port.port === get(path, 'backend.servicePort', null) ||
                  port.targetPort === get(path, 'backend.servicePort', null));
              const ingressMatch =
                serviceName === get(path, 'backend.service.name', null) &&
                (port.port === get(path, 'backend.service.port.number', null) ||
                  port.port === get(path, 'backend.service.port.name', null) ||
                  port.targetPort ===
                    get(path, 'backend.service.port.name', null));
              return legacyIngressMatch || ingressMatch;
            });
          });
        });
      }),
    );
}

const importanceOfDocuments = [
  'Deployment',
  // 'Ingress',
  // 'PersistentVolumeClaim',
  // 'ConfigMap',
  // 'Secret',
  // 'Service',
  // 'ReplicaSet',
];
export function sortDocs(docs) {
  return docs.sort((a, b) => {
    // < 0 => a first
    // 0 ... no change
    // > 0 => b first
    const isAppTemplate = (c) => {
      return (
        (c?.kind === 'Deployment' &&
          (((c || {}).metadata || {}).annotations || {})[
            'kubesail.com/template'
          ]) ||
        ''
      );
    };
    const iA = importanceOfDocuments.indexOf(a.kind);
    const iB = importanceOfDocuments.indexOf(b.kind);
    if (isAppTemplate(a) && isAppTemplate(b)) {
      return (a?.metadata?.name || '').localeCompare(b?.metadata?.name || '');
    } else if (isAppTemplate(a)) {
      return -1;
    } else if (isAppTemplate(b)) {
      return 1;
    } else if (iA < iB) {
      return -1;
    } else if (iA === -1) {
      return -1;
    } else if (a.kind === b.kind) {
      return (a?.metadata?.name || '').localeCompare(b?.metadata?.name || '');
    } else {
      return 1;
    }
  });
}
