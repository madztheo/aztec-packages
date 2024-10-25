// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.27;

import {ApellaBase} from "./base.t.sol";
import {IApella} from "@aztec/governance/interfaces/IApella.sol";
import {Timestamp} from "@aztec/core/libraries/TimeMath.sol";
import {Errors} from "@aztec/governance/libraries/Errors.sol";
import {DataStructures} from "@aztec/governance/libraries/DataStructures.sol";
import {ConfigurationLib} from "@aztec/governance/libraries/ConfigurationLib.sol";
import {Timestamp} from "@aztec/core/libraries/TimeMath.sol";

contract UpdateConfigurationTest is ApellaBase {
  using ConfigurationLib for DataStructures.Configuration;

  DataStructures.Configuration internal config;

  // Doing this as we are using a lib that works on storage
  DataStructures.Configuration internal fresh;

  function setUp() public override(ApellaBase) {
    super.setUp();
    config = apella.getConfiguration();
  }

  function test_WhenCallerIsNotSelf() external {
    // it revert
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__CallerNotSelf.selector, address(this), address(apella))
    );
    apella.updateConfiguration(config);
  }

  modifier whenCallerIsSelf() {
    _;
  }

  modifier whenConfigurationIsInvalid() {
    _;
  }

  function test_WhenQuorumLtMinOrGtMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsInvalid
  {
    // it revert
    config.quorum = bound(_val, 0, ConfigurationLib.QUORUM_LOWER - 1);
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__ConfigurationLib__QuorumTooSmall.selector)
    );

    vm.prank(address(apella));
    apella.updateConfiguration(config);

    config.quorum = bound(_val, ConfigurationLib.QUORUM_UPPER + 1, type(uint256).max);
    vm.expectRevert(abi.encodeWithSelector(Errors.Apella__ConfigurationLib__QuorumTooBig.selector));

    vm.prank(address(apella));
    apella.updateConfiguration(config);
  }

  function test_WhenDifferentialLtMinOrGtMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsInvalid
  {
    // it revert
    config.voteDifferential =
      bound(_val, ConfigurationLib.DIFFERENTIAL_UPPER + 1, type(uint256).max);
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__ConfigurationLib__DifferentialTooBig.selector)
    );

    vm.prank(address(apella));
    apella.updateConfiguration(config);
  }

  function test_WhenMinimumVotesLtMin(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsInvalid
  {
    // it revert
    config.minimumVotes = bound(_val, 0, ConfigurationLib.VOTES_LOWER - 1);
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__ConfigurationLib__InvalidMinimumVotes.selector)
    );

    vm.prank(address(apella));
    apella.updateConfiguration(config);
  }

  function test_WhenVotingDelayLtMinOrGtMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsInvalid
  {
    // it revert

    config.votingDelay =
      Timestamp.wrap(bound(_val, 0, Timestamp.unwrap(ConfigurationLib.TIME_LOWER) - 1));
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__ConfigurationLib__TimeTooSmall.selector, "VotingDelay")
    );
    vm.prank(address(apella));
    apella.updateConfiguration(config);

    config.votingDelay = Timestamp.wrap(
      bound(_val, Timestamp.unwrap(ConfigurationLib.TIME_UPPER) + 1, type(uint256).max)
    );
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__ConfigurationLib__TimeTooBig.selector, "VotingDelay")
    );
    vm.prank(address(apella));
    apella.updateConfiguration(config);
  }

  function test_WhenVotingDurationLtMinOrGtMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsInvalid
  {
    // it revert

    config.votingDuration =
      Timestamp.wrap(bound(_val, 0, Timestamp.unwrap(ConfigurationLib.TIME_LOWER) - 1));
    vm.expectRevert(
      abi.encodeWithSelector(
        Errors.Apella__ConfigurationLib__TimeTooSmall.selector, "VotingDuration"
      )
    );
    vm.prank(address(apella));
    apella.updateConfiguration(config);

    config.votingDuration = Timestamp.wrap(
      bound(_val, Timestamp.unwrap(ConfigurationLib.TIME_UPPER) + 1, type(uint256).max)
    );
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__ConfigurationLib__TimeTooBig.selector, "VotingDuration")
    );
    vm.prank(address(apella));
    apella.updateConfiguration(config);
  }

  function test_WhenExecutionDelayLtMinOrGtMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsInvalid
  {
    // it revert

    config.executionDelay =
      Timestamp.wrap(bound(_val, 0, Timestamp.unwrap(ConfigurationLib.TIME_LOWER) - 1));
    vm.expectRevert(
      abi.encodeWithSelector(
        Errors.Apella__ConfigurationLib__TimeTooSmall.selector, "ExecutionDelay"
      )
    );
    vm.prank(address(apella));
    apella.updateConfiguration(config);

    config.executionDelay = Timestamp.wrap(
      bound(_val, Timestamp.unwrap(ConfigurationLib.TIME_UPPER) + 1, type(uint256).max)
    );
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__ConfigurationLib__TimeTooBig.selector, "ExecutionDelay")
    );
    vm.prank(address(apella));
    apella.updateConfiguration(config);
  }

  function test_WhenGracePeriodLtMinOrGtMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsInvalid
  {
    // it revert

    config.gracePeriod =
      Timestamp.wrap(bound(_val, 0, Timestamp.unwrap(ConfigurationLib.TIME_LOWER) - 1));
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__ConfigurationLib__TimeTooSmall.selector, "GracePeriod")
    );
    vm.prank(address(apella));
    apella.updateConfiguration(config);

    config.gracePeriod = Timestamp.wrap(
      bound(_val, Timestamp.unwrap(ConfigurationLib.TIME_UPPER) + 1, type(uint256).max)
    );
    vm.expectRevert(
      abi.encodeWithSelector(Errors.Apella__ConfigurationLib__TimeTooBig.selector, "GracePeriod")
    );
    vm.prank(address(apella));
    apella.updateConfiguration(config);
  }

  modifier whenConfigurationIsValid() {
    // the local `config` will be modified throughout the execution
    // We check that it matches the what is seen on chain afterwards
    DataStructures.Configuration memory old = apella.getConfiguration();

    _;

    vm.expectEmit(true, true, true, true, address(apella));
    emit IApella.ConfigurationUpdated(Timestamp.wrap(block.timestamp));
    vm.prank(address(apella));
    apella.updateConfiguration(config);

    fresh = apella.getConfiguration();

    assertEq(config.executionDelay, fresh.executionDelay);
    assertEq(config.gracePeriod, fresh.gracePeriod);
    assertEq(config.minimumVotes, fresh.minimumVotes);
    assertEq(config.quorum, fresh.quorum);
    assertEq(config.voteDifferential, fresh.voteDifferential);
    assertEq(config.votingDelay, fresh.votingDelay);
    assertEq(config.votingDuration, fresh.votingDuration);

    assertEq(config.lockDelay(), fresh.lockDelay());
    assertEq(
      config.lockDelay(),
      Timestamp.wrap(Timestamp.unwrap(fresh.votingDelay) / 5) + fresh.votingDuration
        + fresh.executionDelay
    );

    // Ensure that there is a difference between the two
    assertFalse(
      old.executionDelay == fresh.executionDelay && old.gracePeriod == fresh.gracePeriod
        && old.minimumVotes == fresh.minimumVotes && old.quorum == fresh.quorum
        && old.voteDifferential == fresh.voteDifferential && old.votingDelay == fresh.votingDelay
        && old.votingDuration == fresh.votingDuration
    );
  }

  function test_WhenQuorumGeMinAndLeMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsValid
  {
    // it updates the configuration
    // it emits {ConfigurationUpdated} event

    uint256 val = bound(_val, ConfigurationLib.QUORUM_LOWER, ConfigurationLib.QUORUM_UPPER);

    vm.assume(val != config.quorum);
    config.quorum = val;
  }

  function test_WhenDifferentialGeMinAndLeMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsValid
  {
    // it updates the configuration
    // it emits {ConfigurationUpdated} event

    uint256 val = bound(_val, 0, ConfigurationLib.DIFFERENTIAL_UPPER);

    vm.assume(val != config.voteDifferential);
    config.voteDifferential = val;
  }

  function test_WhenMinimumVotesGeMin(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsValid
  {
    // it updates the configuration
    // it emits {ConfigurationUpdated} event

    uint256 val = bound(_val, ConfigurationLib.VOTES_LOWER, type(uint256).max);

    vm.assume(val != config.minimumVotes);
    config.minimumVotes = val;
  }

  function test_WhenVotingDelayGeMinAndLeMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsValid
  {
    // it updates the configuration
    // it emits {ConfigurationUpdated} event
    Timestamp val = Timestamp.wrap(
      bound(
        _val,
        Timestamp.unwrap(ConfigurationLib.TIME_LOWER),
        Timestamp.unwrap(ConfigurationLib.TIME_UPPER)
      )
    );

    vm.assume(val != config.votingDelay);
    config.votingDelay = val;
  }

  function test_WhenVotingDurationGeMinAndLeMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsValid
  {
    // it updates the configuration
    // it emits {ConfigurationUpdated} event
    Timestamp val = Timestamp.wrap(
      bound(
        _val,
        Timestamp.unwrap(ConfigurationLib.TIME_LOWER),
        Timestamp.unwrap(ConfigurationLib.TIME_UPPER)
      )
    );

    vm.assume(val != config.votingDuration);
    config.votingDuration = val;
  }

  function test_WhenExecutionDelayGeMinAndLeMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsValid
  {
    // it updates the configuration
    // it emits {ConfigurationUpdated} event

    Timestamp val = Timestamp.wrap(
      bound(
        _val,
        Timestamp.unwrap(ConfigurationLib.TIME_LOWER),
        Timestamp.unwrap(ConfigurationLib.TIME_UPPER)
      )
    );

    vm.assume(val != config.executionDelay);
    config.executionDelay = val;
  }

  function test_WhenGracePeriodGeMinAndLeMax(uint256 _val)
    external
    whenCallerIsSelf
    whenConfigurationIsValid
  {
    // it updates the configuration
    // it emits {ConfigurationUpdated} event

    Timestamp val = Timestamp.wrap(
      bound(
        _val,
        Timestamp.unwrap(ConfigurationLib.TIME_LOWER),
        Timestamp.unwrap(ConfigurationLib.TIME_UPPER)
      )
    );

    vm.assume(val != config.gracePeriod);
    config.gracePeriod = val;
  }
}
