import React, { Component } from 'react';

import { withStyles } from '@mui/styles';

import {
    IconButton,
    Tooltip,
    InputAdornment,
    LinearProgress,
    TextField,
} from '@mui/material';

import {
    Refresh as RefreshIcon,
    ViewList as ViewListIcon,
    ViewModule as ViewModuleIcon,
    Close as CloseIcon,
} from '@mui/icons-material';

import {
    withWidth,
    Utils as UtilsCommon,
    type AdminConnection,
    type IobTheme,
    type ThemeType,
} from '@iobroker/adapter-react-v5';

import SlowConnectionWarningDialog, { SlowConnectionWarningDialogClass } from '@/dialogs/SlowConnectionWarningDialog';
import type HostsWorker from '@/Workers/HostsWorker';
import type { NotificationAnswer, HostAliveEvent, HostEvent } from '@/Workers/HostsWorker';
import type { RepoInstanceObject } from '@/dialogs/AdapterUpdateDialog';
import TabContainer from '../components/TabContainer';
import TabContent from '../components/TabContent';
import TabHeader from '../components/TabHeader';
import HostCard from '../components/Hosts/HostCard';
import HostRow from '../components/Hosts/HostRow';
import ComponentUtils from '../components/Utils';

const styles: Record<string, any> = (theme: IobTheme) => ({
    grow: {
        flexGrow: 1,
    },
    cards: {
        display: 'flex',
        flexFlow: 'wrap',
        justifyContent: 'center',
    },
    tabHeaderWrapper: {
        height: 30,
        display: 'flex',
        margin: 7,
    },
    tabHeaderFirstItem: {
        width: 306,
        paddingLeft: 30,
        fontSize: 14,
        fontWeight: 600,
        alignSelf: 'center',
    },
    tabHeaderItem: {
        flex: 1,
        fontSize: 14,
        fontWeight: 600,
        alignSelf: 'center',
    },
    tabHeaderItemButton: {
        width: 192,
        fontSize: 14,
        fontWeight: 600,
        alignSelf: 'center',
    },
    widthButtons: {
        width: 240,
    },
    tabFlex: {
        display: 'flex',
        flex: 1,
        padding: '0 10px',
    },
    bold: {
        fontWeight: 'bold',
    },
    marginRight: {
        marginRight: 'auto',
    },
    notStableRepo: {
        background: theme.palette.mode === 'dark' ? '#8a7e00' : '#fdee20',
        color: '#000',
        fontSize: 14,
        padding: '2px 8px',
        borderRadius: 5,
    },
    '@media screen and (max-width: 1100px)': {
        hidden1100: {
            display: 'none !important',
        },
    },
    '@media screen and (max-width: 800px)': {
        hidden800: {
            display: 'none !important',
        },
    },
    '@media screen and (max-width: 600px)': {
        hidden600: {
            display: 'none !important',
        },
    },
    jsController: {
        fontSize: 12,
        opacity: 0.4,
        display: 'block',
    },
});

const wordCache: Record<string, string> = {};

/**
 * Preprocess host data to harmonize information
 *
 * @param hostData Host data from controller
 */
function preprocessHostData(hostData: Record<string, any>): void {
    if (hostData.dockerInformation?.isDocker) {
        let dockerString = hostData.dockerInformation.isOfficial ? 'official image' : 'unofficial image';

        if (hostData.dockerInformation.isOfficial) {
            dockerString +=  ` - ${hostData.dockerInformation.officialVersion}`;
        }

        hostData.Platform = `${hostData.Platform} (${dockerString})`;
    }

    delete hostData.dockerInformation;
}

interface HostsProps {
    t: (word: string, ...args: any) => string;
    expertMode: boolean;
    socket: AdminConnection;
    systemConfig: ioBroker.SystemConfigObject;
    executeCommand: (command: string) => void;
    hostsWorker: HostsWorker;
    showAdaptersWarning: (notifications: Record<string, NotificationAnswer>, hostId: string) => void;
    theme: IobTheme;
    noTranslation: boolean;
    toggleTranslation: () => void;
    currentHost: string;
    adminInstance: string;
    onUpdating: (updating: boolean) => void;
    themeType: ThemeType;
    lang: ioBroker.Languages;
    classes: Record<string, string>;
}

interface HostsState {
    repository: Record<string, RepoInstanceObject>;
    viewMode: boolean;
    alive: Record<`system.host.${string}`, boolean>;
    hosts: ioBroker.HostObject[];
    hostsData: Record<`system.host.${string}`, Record<string, any> | string>;
    filterText: string;
    showSlowConnectionWarning: boolean;
    readTimeoutMs: number;
}

// every tab should get their data itself from server
class Hosts extends Component<HostsProps, HostsState> {
    constructor(props: HostsProps) {
        super(props);

        this.state = {
            viewMode: ((window as any)._localStorage as Storage || window.localStorage).getItem('Hosts.viewMode') === 'true',
            alive: {},
            hosts: [],
            repository: {},
            hostsData: {},
            filterText: ((window as any)._localStorage as Storage || window.localStorage).getItem('Hosts.filterText') || '',
            showSlowConnectionWarning: false,
            readTimeoutMs: SlowConnectionWarningDialogClass.getReadTimeoutMs(),
        };
    }

    // cache translations
    t = (word: string, arg1?: any, arg2?: any): string => {
        if (arg1 !== undefined && arg2 !== undefined && !wordCache[`${word} ${arg1} ${arg2}`]) {
            wordCache[`${word} ${arg1} ${arg2}`] = this.props.t(word, arg1, arg2);
        } else if (arg1 !== undefined && !wordCache[`${word} ${arg1}`]) {
            wordCache[`${word} ${arg1}`] = this.props.t(word, arg1);
        } else if (!wordCache[word]) {
            wordCache[word] = this.props.t(word);
        }

        return arg1 !== undefined && arg2 !== undefined ? wordCache[`${word} ${arg1} ${arg2}`] : (arg1 !== undefined ? wordCache[`${word} ${arg1}`] : wordCache[word]);
    };

    async componentDidMount() {
        this.readInfo()
            .then(() => {
                this.props.hostsWorker.registerHandler(this.updateHosts);
                this.props.hostsWorker.registerAliveHandler(this.updateHostsAlive);
            });
    }

    componentWillUnmount() {
        this.props.hostsWorker.unregisterHandler(this.updateHosts);
        this.props.hostsWorker.unregisterAliveHandler(this.updateHostsAlive);
    }

    getHostsData(hosts: ioBroker.HostObject[], _alive: Record<string, boolean>): Promise<Record<string, Record<string, any> | string>> {
        const promises: Promise<{ id: `system.host.${string}`; data: Record<string, any> | string}>[] = [];

        for (let h = 0; h < hosts.length; h++) {
            if (_alive[hosts[h]._id]) {
                const promise = this.props.socket.getHostInfo(hosts[h]._id, null, this.state.readTimeoutMs)
                    .catch((error: string) => {
                        console.error(`Cannot get getHostInfo: ${error}`);
                        error.toString().includes('timeout') && this.setState({ showSlowConnectionWarning: true });
                        return { id: hosts[h]._id as `system.host.${string}`, data: error.toString() };
                    })
                    .then((data: Record<string, any>) => {
                        preprocessHostData(data);
                        return { id: hosts[h]._id as `system.host.${string}`, data };
                    });
                promises.push(promise);
            } else {
                promises.push(Promise.resolve({ id: hosts[h]._id as `system.host.${string}`, data: 'offline' }));
            }
        }

        return Promise.all(promises)
            .then(results => {
                const _hostsData: Record<string, Record<string, any> | string> = {};
                results.forEach(res => _hostsData[res.id] = res.data);
                return _hostsData;
            });
    }

    readInfo() {
        return this.props.socket.getHosts(true)
            .then(hosts => this.props.socket.getRepository(this.props.currentHost, { update: false }, false, this.state.readTimeoutMs)
                .then(async repository => {
                    const alive = JSON.parse(JSON.stringify(this.state.alive));

                    for (let h = 0; h < hosts.length; h++) {
                        const aliveValue = await this.props.socket.getState(`${hosts[h]._id}.alive`);
                        alive[hosts[h]._id] = !aliveValue ? false : !!aliveValue.val;
                    }

                    const hostsData = await this.getHostsData(hosts, alive);
                    const newState: Partial<HostsState> = {
                        alive,
                        hosts,
                        hostsData,
                        repository,
                    };
                    if (this.state.filterText && hosts.length <= 2) {
                        newState.filterText = '';
                    }
                    this.setState(newState as HostsState);
                })
                .catch(e => {
                    window.alert(`Cannot getRepository: ${e}`);
                    e.toString().includes('timeout') && this.setState({ showSlowConnectionWarning: true });
                }));
    }

    updateHosts = (events: HostEvent[]) => {
        const hosts: ioBroker.HostObject[] = JSON.parse(JSON.stringify(this.state.hosts));
        const alive: Record<`system.host.${string}`, boolean> = JSON.parse(JSON.stringify(this.state.alive));

        Promise.all(events.map(async event => {
            const elementFind = hosts.find(host => host._id === event.id);
            if (elementFind) {
                const index = hosts.indexOf(elementFind);
                if (event.obj) {
                    // updated
                    hosts[index] = event.obj;
                } else {
                    // deleted
                    hosts.splice(index, 1);
                }
            } else {
                const state = await this.props.socket.getState(`${event.id}.alive`);
                alive[event.id as `system.host.${string}`] = !!state?.val;
                // new
                hosts.push(event.obj);
            }
        }))
            .then(() => {
                const newState: Partial<HostsState> = { hosts, alive };

                if (this.state.filterText && hosts.length <= 2) {
                    newState.filterText = '';
                }

                this.setState(newState as HostsState);
            });
    };

    updateHostsAlive = (events: HostAliveEvent[]) => {
        const alive: Record<`system.host.${string}`, boolean> = JSON.parse(JSON.stringify(this.state.alive));
        let changed = false;

        events.forEach(event => {
            if (event.type === 'deleted') {
                if (alive[event.id] !== undefined) {
                    delete alive[event.id];
                    changed = true;
                }
            } else if ((!!alive[event.id]) !== (!!event.alive)) {
                alive[event.id] = event.alive;
                changed = true;
            }
        });

        changed && this.setState({ alive });
    };

    getPanels() {
        const items = this.renderHosts()
            .filter(host => host);

        return items.length ? items : this.t('All items are filtered out');
    }

    renderSlowConnectionWarning() {
        if (!this.state.showSlowConnectionWarning) {
            return null;
        }
        return <SlowConnectionWarningDialog
            readTimeoutMs={this.state.readTimeoutMs}
            t={this.t}
            onClose={async readTimeoutMs => {
                this.setState({ showSlowConnectionWarning: false });
                if (readTimeoutMs) {
                    this.setState({ readTimeoutMs });
                    await this.readInfo();
                }
            }}
        />;
    }

    renderHosts() {
        return this.state.hosts.map(host => {
            if (this.state.filterText && !host.common.name.toLowerCase().includes(this.state.filterText.toLowerCase())) {
                return null;
            }
            const HostElement = this.state.viewMode ? HostCard : HostRow;

            return <HostElement
                key={host._id}
                adminInstance={this.props.adminInstance}
                alive={this.state.alive[host._id]}
                available={this.state.repository['js-controller']?.version || '-'}
                executeCommandRemove={() => this.props.executeCommand(`host remove ${host.common.name}`)}
                expertMode={this.props.expertMode}
                host={host}
                hostData={this.state.hostsData[host._id]}
                hostId={host._id as `system.host.${string}`}
                hostsWorker={this.props.hostsWorker}
                isCurrentHost={this.props.currentHost === host._id}
                jsControllerInfo={this.state.repository['js-controller']}
                lang={this.props.lang}
                noTranslation={this.props.noTranslation}
                onUpdating={this.props.onUpdating}
                showAdaptersWarning={this.props.showAdaptersWarning}
                socket={this.props.socket}
                systemConfig={this.props.systemConfig}
                t={this.t}
                theme={this.props.theme}
                themeType={this.props.themeType}
                toggleTranslation={this.props.toggleTranslation}
            />;
        });
    }

    render() {
        const {
            classes,
            expertMode,
        } = this.props;

        if (!this.state.hosts.length) {
            return <LinearProgress />;
        }

        return <TabContainer>
            {this.renderSlowConnectionWarning()}
            <TabHeader>
                <Tooltip title={this.t('Show / hide List')}>
                    <IconButton
                        size="large"
                        onClick={() => {
                            ((window as any)._localStorage as Storage || window.localStorage).setItem('Hosts.viewMode', this.state.viewMode ? 'false' : 'true');
                            this.setState({ viewMode: !this.state.viewMode });
                        }}
                    >
                        {this.state.viewMode ? <ViewModuleIcon /> : <ViewListIcon />}
                    </IconButton>
                </Tooltip>
                <Tooltip title={this.t('Reload')}>
                    <IconButton size="large" onClick={() => this.forceUpdate()}>
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
                <div className={classes.grow} />
                {this.state.hosts.length > 2 ? <TextField
                    variant="standard"
                    label={this.t('Filter')}
                    style={{ margin: '5px 0' }}
                    value={this.state.filterText}
                    onChange={event => {
                        ((window as any)._localStorage as Storage || window.localStorage).setItem('Hosts.viewMode', event.target.value);
                        this.setState({ filterText: event.target.value });
                    }}
                    InputProps={{
                        endAdornment: this.state.filterText ? <InputAdornment position="end">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    ((window as any)._localStorage as Storage || window.localStorage).setItem('Hosts.viewMode', '');
                                    this.setState({ filterText: '' });
                                }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </InputAdornment> : null,
                    }}
                /> : null}
                <div className={classes.grow} />
            </TabHeader>
            <TabContent overflow="auto">
                {!ComponentUtils.isStableRepository(this.props.systemConfig.common.activeRepo) ?
                    <div className={this.props.classes.notStableRepo}>{this.t('Active repo is "%s"', this.props.systemConfig.common.activeRepo)}</div> : null}
                <div className={this.state.viewMode ? classes.cards : ''}>
                    {!this.state.viewMode &&
                        <div className={classes.tabHeaderWrapper}>
                            <div className={classes.tabHeaderFirstItem}>
                                {this.t('Name:')}
                            </div>
                            <div className={classes.tabFlex}>
                                {/* <div className={UtilsCommon.clsx(classes.tabHeaderItem, classes.hidden600)}>{t('Title:')}</div> */}
                                <div className={UtilsCommon.clsx(classes.tabHeaderItem, classes.hidden800)}>CPU</div>
                                <div className={UtilsCommon.clsx(classes.tabHeaderItem, classes.hidden800)}>RAM</div>
                                <div className={UtilsCommon.clsx(classes.tabHeaderItem, classes.hidden800)}>{this.t('Uptime')}</div>
                                <div className={UtilsCommon.clsx(classes.tabHeaderItem, classes.hidden1100)}>
                                    {this.t('Available')}
                                    <div className={classes.jsController}>js-controller</div>
                                </div>
                                <div className={UtilsCommon.clsx(classes.tabHeaderItem, classes.hidden1100)}>
                                    {this.t('Installed')}
                                    <div className={classes.jsController}>js-controller</div>
                                </div>
                                <div className={UtilsCommon.clsx(classes.tabHeaderItem, classes.hidden600)}>{this.t('Events')}</div>
                                <div className={UtilsCommon.clsx(classes.tabHeaderItemButton, expertMode && classes.widthButtons)} />
                            </div>
                        </div>}
                    {this.getPanels()}
                </div>
            </TabContent>
        </TabContainer>;
    }
}

export default withWidth()(withStyles(styles)(Hosts));
