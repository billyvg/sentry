import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {IconFlag} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import InputControl from 'app/views/settings/components/forms/controls/input';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import {ProjectKey} from 'app/views/settings/project/projectKeys/types';

const RATE_LIMIT_FORMAT_MAP = new Map([
  [0, 'None'],
  [60, '1 minute'],
  [300, '5 minutes'],
  [900, '15 minutes'],
  [3600, '1 hour'],
  [7200, '2 hours'],
  [14400, '4 hours'],
  [21600, '6 hours'],
  [43200, '12 hours'],
  [86400, '24 hours'],
]);

type RateLimitValue = {
  window: number;
  count: number;
};

// This value isn't actually any, but the various angles on the types don't line up.
const formatRateLimitWindow = (val: any) => RATE_LIMIT_FORMAT_MAP.get(val);

type Props = {
  data: ProjectKey;
  disabled: boolean;
} & Pick<
  RouteComponentProps<
    {
      keyId: string;
      orgId: string;
      projectId: string;
    },
    {}
  >,
  'params'
>;

class KeyRateLimitsForm extends React.Component<Props> {
  handleChangeWindow = (
    onChange,
    onBlur,
    currentValueObj: RateLimitValue,
    value: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const valueObj = {
      ...currentValueObj,
      window: value,
    };
    onChange(valueObj, e);
    onBlur(valueObj, e);
  };

  handleChangeCount = (
    cb,
    value: RateLimitValue,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const valueObj = {
      ...value,
      count: e.target.value,
    };

    cb(valueObj, e);
  };

  render() {
    const {data, disabled} = this.props;
    const {keyId, orgId, projectId} = this.props.params;
    const apiEndpoint = `/projects/${orgId}/${projectId}/keys/${keyId}/`;

    const disabledAlert = ({features}) => (
      <FeatureDisabled
        alert={PanelAlert}
        features={features}
        featureName={t('Key Rate Limits')}
      />
    );

    return (
      <Form saveOnBlur apiEndpoint={apiEndpoint} apiMethod="PUT" initialData={data}>
        <Feature
          features={['projects:rate-limits']}
          hookName="feature-disabled:rate-limits"
          renderDisabled={({children, ...props}) =>
            typeof children === 'function' &&
            children({...props, renderDisabled: disabledAlert})
          }
        >
          {({hasFeature, features, organization, project, renderDisabled}) => (
            <Panel>
              <PanelHeader>{t('Rate Limits')}</PanelHeader>

              <PanelBody>
                <PanelAlert type="info" icon={<IconFlag size="md" />}>
                  {t(
                    `Rate limits provide a flexible way to manage your error
                      volume. If you have a noisy project or environment you
                      can configure a rate limit for this key to reduce the
                      number of errors processed. To manage your transaction
                      volume, we recommend adjusting your sample rate in your
                      SDK configuration.`
                  )}
                </PanelAlert>
                {!hasFeature &&
                  typeof renderDisabled === 'function' &&
                  renderDisabled({
                    organization,
                    project,
                    features,
                    hasFeature,
                    children: null,
                  })}
                <FormField
                  className="rate-limit-group"
                  name="rateLimit"
                  label={t('Rate Limit')}
                  disabled={disabled || !hasFeature}
                  validate={({form}) => {
                    //TODO(TS): is validate actually doing anything because it's an unexpected prop
                    const isValid =
                      form &&
                      form.rateLimit &&
                      typeof form.rateLimit.count !== 'undefined' &&
                      typeof form.rateLimit.window !== 'undefined';

                    if (isValid) {
                      return [];
                    }

                    return [['rateLimit', t('Fill in both fields first')]];
                  }}
                  formatMessageValue={(value: RateLimitValue) => {
                    return t(
                      '%s errors in %s',
                      value.count,
                      formatRateLimitWindow(value.window)
                    );
                  }}
                  help={t(
                    'Apply a rate limit to this credential to cap the amount of errors accepted during a time window.'
                  )}
                  inline={false}
                >
                  {({onChange, onBlur, value}) => (
                    <RateLimitRow>
                      <InputControl
                        type="number"
                        name="rateLimit.count"
                        min={0}
                        value={value && value.count}
                        placeholder={t('Count')}
                        disabled={disabled || !hasFeature}
                        onChange={this.handleChangeCount.bind(this, onChange, value)}
                        onBlur={this.handleChangeCount.bind(this, onBlur, value)}
                      />
                      <EventsIn>{t('event(s) in')}</EventsIn>
                      <RangeSlider
                        name="rateLimit.window"
                        allowedValues={Array.from(RATE_LIMIT_FORMAT_MAP.keys())}
                        value={value && value.window}
                        placeholder={t('Window')}
                        formatLabel={formatRateLimitWindow}
                        disabled={disabled || !hasFeature}
                        onChange={this.handleChangeWindow.bind(
                          this,
                          onChange,
                          onBlur,
                          value
                        )}
                      />
                    </RateLimitRow>
                  )}
                </FormField>
              </PanelBody>
            </Panel>
          )}
        </Feature>
      </Form>
    );
  }
}

export default KeyRateLimitsForm;

const RateLimitRow = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr 2fr;
  align-items: center;
  grid-gap: ${space(1)};
`;

const EventsIn = styled('small')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  text-align: center;
  white-space: nowrap;
`;
