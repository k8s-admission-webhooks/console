import * as _ from 'lodash-es';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, ActionGroup, Button } from '@patternfly/react-core';
import { PlusCircleIcon, MinusCircleIcon } from '@patternfly/react-icons';
import { ButtonBar, Dropdown, history, ResourceName, resourcePathFromModel } from '../utils';
import { k8sCreate, k8sList, K8sResourceKind } from '../../module/k8s';
import { getActiveNamespace } from '../../actions/ui';
import { DeploymentModel, DeploymentConfigModel, ServiceModel } from '../../models';

const MAX_PORT_COUNT = -1;

export class CreateService extends React.Component<{}, CreateServiceState> {
  state = {
    name: '',
    namespace: getActiveNamespace(),
    sourceType: 'Deployment' as ExposeServiceSourceType,
    source: '',
    type: 'ClusterIP' as ExposeServiceType,
    externalName: '',
    headlessService: false,
    sessionAffinity: 'None' as ExposeServiceAffinityType,
    ports: [
      {
        protocol: 'TCP',
        key: _.uniqueId('service-port-'),
      },
    ] as ServicePort[],
    deploymentListLoaded: false,
    deployments: [],
    deploymentConfigListLoaded: false,
    deploymentConfigs: [],
    inProgress: false,
    error: '',
  };

  componentDidMount() {
    k8sList(DeploymentModel, { ns: this.state.namespace })
      .then((deployments) => {
        this.setState({
          deployments,
          deploymentListLoaded: true,
        });
      })
      .catch((err) => {
        this.setState({ error: err.message });
      });
    k8sList(DeploymentConfigModel, { ns: this.state.namespace })
      .then((deploymentConfigs) => {
        this.setState({
          deploymentConfigs,
          deploymentConfigListLoaded: true,
        });
      })
      .catch((err) => {
        this.setState({
          error: err.message,
        });
      });
  }
  save = (event) => {
    event.preventDefault();

    const {
      name,
      namespace,
      type,
      externalName,
      headlessService,
      sourceType,
      source,
      ports,
      deployments,
      deploymentConfigs,
    } = this.state;

    const sourceObject = _.find(sourceType === 'Deployment' ? deployments : deploymentConfigs, {
      metadata: { name: source },
    });

    const service: K8sResourceKind = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name, namespace },
      spec: {
        type,
        selector: sourceObject.spec.selector,
        ports: _.map(ports, (p) => {
          const result: ServicePortNoKey = {
            protocol: p.protocol,
          };
          if (p.name) {
            result.name = p.name;
          }
          if (p.port) {
            result.port = p.port;
          }
          if (p.targetPort) {
            result.targetPort = p.targetPort;
          }
          return result;
        }),
      },
    };
    if (type === 'ExternalName') {
      service.spec.externalName = externalName;
    }
    if (headlessService) {
      service.spec.clusterIP = 'None';
    }

    this.setState({ inProgress: true });
    k8sCreate(ServiceModel, service).then(
      () => {
        this.setState({
          inProgress: false,
        });
        history.push(resourcePathFromModel(ServiceModel, name, namespace));
      },
      (err) => {
        this.setState({
          inProgress: false,
          error: err.message,
        });
      },
    );
  };
  handleChange: React.ReactEventHandler<HTMLInputElement> = (event) => {
    const target = event.currentTarget;
    const name = target.name;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    this.setState({
      [name]: value,
    } as any);
  };
  changeSourceType = (value: ExposeServiceSourceType) => {
    this.setState({
      source: '',
      sourceType: value,
    });
  };
  changeSource = (value: string) => {
    this.setState({
      source: value,
    });
  };
  changeServiceType = (value: ExposeServiceType) => {
    this.setState({
      type: value,
    });
  };
  changeSessionAffinity = (value: ExposeServiceAffinityType) => {
    this.setState({
      sessionAffinity: value,
    });
  };
  addPort = () => {
    this.setState(({ ports }) => {
      const updatedPorts = [...ports];
      updatedPorts.push({ protocol: 'TCP', key: _.uniqueId('service-port-') });
      return {
        ports: updatedPorts,
      };
    });
  };
  removePort = (index: number) => {
    this.setState(({ ports }) => {
      const updatedPorts = [...ports];
      updatedPorts.splice(index, 1);
      return {
        ports: updatedPorts,
      };
    });
  };
  changePort = (index: number, name: string, value: any) => {
    this.setState(({ ports }) => {
      const updatedPorts = [...ports];
      const updatedPort: ServicePort = {
        key: updatedPorts[index].key,
        protocol: updatedPorts[index].protocol,
        port: updatedPorts[index].port,
        targetPort: updatedPorts[index].targetPort,
        targetPortAssignedByUser: updatedPorts[index].targetPortAssignedByUser,
      };
      updatedPort[name] = value;
      if (name === 'targetPort') {
        updatedPort.targetPortAssignedByUser = true;
      } else if (name === 'port' && !updatedPort.targetPortAssignedByUser) {
        updatedPort.targetPort = value;
      }
      updatedPorts[index] = updatedPort;
      return {
        ports: updatedPorts,
      };
    });
  };
  render() {
    const title = 'Create Service';
    const sourceTypeOptions = {
      Deployment: 'Deployment',
      DeploymentConfig: 'DeploymentConfig',
    };
    const serviceTypeOptions = {
      ClusterIP: 'ClusterIP',
      LoadBalancer: 'LoadBalancer',
      ExternalName: 'ExternalName',
    };
    const sessionAffinityOptions = {
      None: 'None',
      Client: 'Client',
    };
    const {
      name,
      namespace,
      deploymentListLoaded,
      deployments,
      deploymentConfigListLoaded,
      deploymentConfigs,
      sourceType,
      type,
      externalName,
      headlessService,
      sessionAffinity,
      ports,
    } = this.state;
    let loaded: boolean = false;
    const sourceOptions = {};
    if (sourceType === 'Deployment') {
      loaded = deploymentListLoaded;
      _.each(
        _.sortBy(deployments, 'metadata.name'),
        ({ metadata: { resname } }) =>
          (sourceOptions[resname] = <ResourceName kind="Deployment" name={resname} />),
      );
    } else {
      loaded = deploymentConfigListLoaded;
      _.each(
        _.sortBy(deploymentConfigs, 'metadata.name'),
        ({ metadata: { resname } }) =>
          (sourceOptions[resname] = <ResourceName kind="DeploymentConfig" name={resname} />),
      );
    }

    const portOptions = _.map(ports, (port, index) => {
      return (
        <PortGroup
          key={port.key}
          index={index}
          port={port}
          canRemove={ports.length > 1}
          onChange={this.changePort}
          onRemove={this.removePort}
        />
      );
    });

    return (
      <>
        <div className="co-m-pane__body co-m-pane__form">
          <h1 className="co-m-pane__heading co-m-pane__heading--baseline">
            <div className="co-m-pane__name">{title}</div>
            <div className="co-m-pane__heading-link">
              <Link
                to={`/k8s/ns/${namespace}/services/~new`}
                id="yaml-link"
                data-test="yaml-link"
                replace
              >
                Edit YAML
              </Link>
            </div>
          </h1>
          <p className="co-m-pane__explanation">
            A Kubernetes Service is an abstraction layer which defines a logical set of Pods and
            enables external traffic exposure, load balancing and service discovery for those Pods.
          </p>
          <form onSubmit={this.save} className="co-create-service">
            <div className="form-group co-create-service__name">
              <label className="co-required" htmlFor="name">
                Name
              </label>
              <input
                className="pf-c-form-control"
                type="text"
                onChange={this.handleChange}
                value={name}
                placeholder="my-service"
                id="name"
                name="name"
                aria-describedby="name-help"
                required
              />
              <div className="help-block" id="name-help">
                <p>A unique name for the service within the project.</p>
              </div>
            </div>
            <div className="form-group co-create-service__source_from">
              <label htmlFor="sourceType">Source From</label>
              <Dropdown
                id="sourceType"
                name="sourceType"
                items={sourceTypeOptions}
                selectedKey={sourceType}
                title="Select source of the service"
                dropDownClassName="dropdown--full-width"
                onChange={this.changeSourceType}
              />
              <div className="help-block" id="sourceType-help">
                <p>Where is the source of the service?</p>
              </div>
            </div>
            <div className="form-group co-create-service__source">
              <label className="co-required" htmlFor="source">
                Source
              </label>
              {loaded && _.isEmpty(sourceOptions) && (
                <Alert
                  isInline
                  className="co-alert co-create-service__alert"
                  variant="info"
                  title={sourceType === 'Deployment' ? 'No Deployment' : 'No DeploymentConfig'}
                >
                  {sourceType === 'Deployment'
                    ? 'There are no Deployment in current project'
                    : 'There are no DeploymentConfig in current projecct'}
                </Alert>
              )}
              {loaded && !_.isEmpty(sourceOptions) && (
                <Dropdown
                  id="source"
                  name="source"
                  items={sourceOptions}
                  dropDownClassName="dropdown--full-width"
                  onChange={this.changeSource}
                />
              )}
              <div className="help-block" id="service-help">
                {sourceType === 'Deployment'
                  ? 'Deployment to expose'
                  : 'DeploymentConfig to expose'}
              </div>
            </div>
            <div className="form-group co-create-service__type">
              <label htmlFor="type">Type</label>
              <Dropdown
                id="type"
                name="type"
                items={serviceTypeOptions}
                selectedKey={type}
                dropDownClassName="dropdown--full-width"
                onChange={this.changeServiceType}
                required
              />
              <div className="help-block" id="service-help">
                Type of the service
              </div>
            </div>
            {type === 'ExternalName' && (
              <div className="form-group co-create-service__external_name">
                <label htmlFor="externalName" className="co-required">
                  External Name
                </label>
                <div className="">
                  <input
                    type="text"
                    id="externalName"
                    name="externalName"
                    className="pf-c-form-control"
                    value={externalName}
                    onChange={this.handleChange}
                  />
                </div>
                <div className="help-block" id="externalName-help">
                  Domain for external name
                </div>
              </div>
            )}
            <div className="form-group co-create-service__headless_service">
              <label>
                <input
                  type="checkbox"
                  id="headlessService"
                  name="headlessService"
                  title="headlessService"
                  checked={headlessService}
                  onChange={this.handleChange}
                />
                Headless service
              </label>
              <div className="help-block">
                <p>
                  Sometimes you don't need load-balancing and a single Service IP. In this case, you
                  can create what are termed "headless" Services
                </p>
              </div>
            </div>
            <div className="from-group co-create-service__session_affinity">
              <label htmlFor="sessionAffinity">Session Affinity</label>
              <Dropdown
                id="sessionAffinity"
                name="sessionAffinity"
                items={sessionAffinityOptions}
                selectedKey={sessionAffinity}
                dropDownClassName="dropdown--full-width"
                onChange={this.changeSessionAffinity}
              />
              <div className="help-block" id="sessionAffinity-help">
                <p>
                  If you want to make sure that connections from a particular client are passed to
                  the same Pod each time, you can select the session affinity based on the client's
                  IP addresses
                </p>
              </div>
            </div>
            {portOptions}
            {(MAX_PORT_COUNT <= 0 || MAX_PORT_COUNT > ports.length) && (
              <Button
                className="pf-m-link--align-left co-create-service__add-port-btn"
                onClick={this.addPort}
                type="button"
                variant="link"
                isInline
              >
                <PlusCircleIcon className="co-icon-space-r" />
                Add another port
              </Button>
            )}
            <ButtonBar errorMessage={this.state.error} inProgress={this.state.inProgress}>
              <ActionGroup className="pf-c-form">
                <Button
                  type="submit"
                  isDisabled={!this.state.name || !this.state.source}
                  id="save-changes"
                  variant="primary"
                >
                  Create
                </Button>
                <Button onClick={history.goBack} id="cancel" variant="secondary">
                  Cancel
                </Button>
              </ActionGroup>
            </ButtonBar>
          </form>
        </div>
      </>
    );
  }
}

export const PortGroup: React.FC<PortGroupProps> = (props) => {
  const { index, onChange, onRemove, port, canRemove } = props;

  const protocolOptions = {
    TCP: 'TCP',
    UDP: 'UDP',
    SCTP: 'SCTP',
  };

  return (
    <>
      <div className="form-group">
        <label htmlFor={`port-${index}-name`}>Name</label>
        <input
          type="text"
          id={`port-${index}-name`}
          name={`port-${index}-name`}
          value={port.name}
          className="pf-c-form-control"
          aria-describedby={`port-${index}-name-help`}
          onChange={(e) => onChange(index, 'name', e.currentTarget.value)}
        />
        <div className="help-block" id={`port-${index}-name-help`}>
          <p>Optional name of this port</p>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor={`port-${index}-protocol`} className="co-required">
          Protocol
        </label>
        <Dropdown
          id={`port-${index}-protocol`}
          name={`port-${index}-protocol`}
          items={protocolOptions}
          selectedKey={port.protocol}
          title="Select protocol of the port"
          dropDownClassName="dropdown--full-width"
          onChange={(value: any) => onChange(index, 'protocol', value)}
        />
        <div className="help-block">
          <p>Protocol that must used with this port</p>
        </div>
      </div>
      <div className="form-group co-create-service__block_label">
        <label htmlFor={`port-${index}-port`}>Port</label>
        <input
          type="number"
          id={`port-${index}-port`}
          name={`port-${index}-port`}
          value={port.port}
          className="pf-c-form-control"
          aria-describedby={`port-${index}-port-help`}
          onChange={(e) => onChange(index, 'port', e.currentTarget.valueAsNumber)}
        />
        <div className="help-block" id={`port-${index}-port-help`}>
          <p>External port number for the service. Please input a value between 0 and 65535</p>
        </div>
      </div>
      <div className="form-group co-create-service__block_label">
        <label className="co-required" htmlFor={`port-${index}-target-port`}>
          Target Port
        </label>
        <input
          type="number"
          id={`port-${index}-target-port`}
          name={`port-${index}-target-port`}
          value={port.targetPort}
          className="pf-c-form-control"
          aria-describedby={`port-${index}-target-port-help`}
          onChange={(e) => onChange(index, 'targetPort', e.currentTarget.valueAsNumber)}
        />
        <div className="help-block" id={`port-${index}-target-port-help`}>
          <p>Internal port number for the service. Please input a value between 0 and 65535</p>
        </div>
        {canRemove && (
          <div className="co-add-remove-form__link--remove-entry">
            <Button type="button" onClick={() => onRemove(index)}>
              <MinusCircleIcon className="co-icon-space-r" />
              Remove port
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export type ExposeServiceSourceType = 'Deployment' | 'DeploymentConfig';
export type ExposeServiceAffinityType = 'None' | 'Client';
export type ExposeServiceType = 'ClusterIP' | 'LoadBalancer' | 'ExternalName' /* | 'NodePort' */;
export type ServicePortType = 'TCP' | 'UDP' | 'SCTP' /* | 'NodePort' */;
export type ServicePortNoKey = {
  name?: string;
  protocol: ServicePortType;
  port?: number;
  targetPort?: number;
};
export type ServicePort = ServicePortNoKey & {
  key: string;
  targetPortAssignedByUser?: boolean;
};
type PortGroupProps = {
  port: ServicePort;
  onChange: Function;
  onRemove: Function;
  index: number;
  canRemove: boolean;
};
export type CreateServiceState = {
  name: string;
  namespace: string;
  sourceType: ExposeServiceSourceType;
  source: string;
  type: ExposeServiceType;
  externalName: string;
  headlessService: boolean;
  sessionAffinity: ExposeServiceAffinityType;
  ports: ServicePort[];
  deploymentListLoaded: boolean;
  deployments: K8sResourceKind[];
  deploymentConfigListLoaded: boolean;
  deploymentConfigs: K8sResourceKind[];
  inProgress: boolean;
  error: string;
};
